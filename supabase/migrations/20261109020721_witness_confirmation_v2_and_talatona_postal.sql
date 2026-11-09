-- Three independent witness confirmations. Privileged operations are service-only;
-- existing address/authority permissions and official certification are unchanged.
ALTER TABLE public.afroloc_witnesses ADD COLUMN confirmation_protocol text;
CREATE TABLE public.afroloc_witness_challenges (
 witness_id uuid PRIMARY KEY REFERENCES public.afroloc_witnesses(id) ON DELETE CASCADE,
 challenge_id uuid NOT NULL DEFAULT gen_random_uuid(),
 otp_hash text NOT NULL CHECK (otp_hash ~ '^[a-f0-9]{64}$'),
 salt text NOT NULL,
 expires_at timestamptz NOT NULL,
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
 delivery_state text NOT NULL DEFAULT 'prepared' CHECK (delivery_state IN ('prepared','sent','failed','consumed')),
 last_sent_at timestamptz NOT NULL DEFAULT now(),
 consumed_at timestamptz
);
CREATE TABLE public.afroloc_witness_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 witness_id uuid REFERENCES public.afroloc_witnesses(id) ON DELETE SET NULL,
 action text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX afroloc_witness_events_rate_idx ON public.afroloc_witness_events(actor_id,created_at);
ALTER TABLE public.afroloc_witness_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afroloc_witness_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.afroloc_witness_challenges, public.afroloc_witness_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.afroloc_witness_challenges, public.afroloc_witness_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.afroloc_witness_events_id_seq TO service_role;

CREATE FUNCTION public.protect_witness_confirmation_v2() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF NEW.confirmation_protocol='otp_v2' AND NEW.status='confirmed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') AND NOT EXISTS(SELECT 1 FROM public.afroloc_witness_challenges WHERE witness_id=NEW.id AND delivery_state='consumed' AND consumed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'O testemunho exige confirmação pessoal com código válido.';
 END IF;
 IF coalesce(current_setting('request.jwt.claims',true),'')='' THEN RETURN NEW; END IF;
 IF coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')='service_role' THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW.confirmation_protocol IS NOT NULL THEN
  RAISE EXCEPTION 'Confirmação gerida pelo serviço AFROLOC.';
 END IF;
 IF TG_OP='UPDATE' AND (OLD.confirmation_protocol='otp_v2' OR NEW.confirmation_protocol IS DISTINCT FROM OLD.confirmation_protocol)
 AND ROW(NEW.id,NEW.afroloc_record_id,NEW.witness_user_id,NEW.witness_afro_id,NEW.status,NEW.signature,NEW.confirmed_at,NEW.confirmation_protocol,NEW.otp_code)
 IS DISTINCT FROM ROW(OLD.id,OLD.afroloc_record_id,OLD.witness_user_id,OLD.witness_afro_id,OLD.status,OLD.signature,OLD.confirmed_at,OLD.confirmation_protocol,OLD.otp_code) THEN
  RAISE EXCEPTION 'Confirmação gerida pelo serviço AFROLOC.';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_witness_confirmation_v2() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_witness_confirmation_v2 BEFORE INSERT OR UPDATE ON public.afroloc_witnesses
FOR EACH ROW EXECUTE FUNCTION public.protect_witness_confirmation_v2();

CREATE FUNCTION public.witness_confirmation_v2(p_actor uuid,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
 target public.afroloc_records%ROWTYPE;
 neighbour public.afroloc_records%ROWTYPE;
 witness public.afroloc_witnesses%ROWTYPE;
 challenge public.afroloc_witness_challenges%ROWTYPE;
 phone_number text;
 distance_m double precision;
 wid uuid;
 decision text;
BEGIN
 -- Identity is verified through Supabase Auth by the service before this RPC.
 IF p_actor IS NULL THEN
  RETURN jsonb_build_object('ok',false,'error','Conta AFROLOC inválida.');
 END IF;
 IF p_action='request' THEN
  SELECT * INTO target FROM public.afroloc_records WHERE id=(p_payload->>'record_id')::uuid AND user_id=p_actor FOR UPDATE;
 ELSE
  SELECT * INTO witness FROM public.afroloc_witnesses WHERE id=(p_payload->>'witness_id')::uuid;
  SELECT * INTO target FROM public.afroloc_records WHERE id=witness.afroloc_record_id FOR UPDATE;
  -- Parent row is always locked first, avoiding request/resend/confirmation deadlocks.
  SELECT * INTO witness FROM public.afroloc_witnesses WHERE id=(p_payload->>'witness_id')::uuid FOR UPDATE;
 END IF;
 IF target.id IS NULL OR (p_actor IS DISTINCT FROM target.user_id AND p_actor IS DISTINCT FROM witness.witness_user_id) THEN
  RETURN jsonb_build_object('ok',false,'error','Não tem acesso a este pedido.');
 END IF;
 IF p_action='info' THEN
  RETURN jsonb_build_object('ok',true,'witness_id',witness.id,'status',witness.status,'is_witness',p_actor=witness.witness_user_id,'afroloc_code',target.code,'municipality',target.level2_name,'zone',target.level4_name,'street',target.street_name,'number',target.number,'unit',target.unit,'temporary',target.is_temporary,'expires_at',target.temporary_expires_at);
 END IF;
 IF p_action='delivery' THEN
  UPDATE public.afroloc_witness_challenges SET delivery_state=CASE WHEN p_payload->>'accepted'='true' THEN 'sent' ELSE 'failed' END
  WHERE witness_id=witness.id AND challenge_id=(p_payload->>'challenge_id')::uuid AND delivery_state='prepared';
  RETURN jsonb_build_object('ok',FOUND);
 END IF;
 IF target.country<>'AO' OR target.status::text IN ('revoked','rejected','expired') OR (target.is_temporary AND (target.temporary_expires_at IS NULL OR target.temporary_expires_at<=now())) THEN
  RETURN jsonb_build_object('ok',false,'error','O endereço não está disponível para confirmação.');
 END IF;
 IF p_action='request' THEN
  SELECT * INTO neighbour FROM public.afroloc_records WHERE upper(code)=upper(trim(p_payload->>'code')) LIMIT 1;
 ELSE
  SELECT * INTO neighbour FROM public.afroloc_records WHERE code=witness.witness_afro_id AND user_id=witness.witness_user_id LIMIT 1;
 END IF;
 IF neighbour.id IS NULL OR neighbour.country<>'AO' OR neighbour.user_id=target.user_id OR neighbour.status::text NOT IN ('verified','certified')
 OR (neighbour.is_temporary AND (neighbour.temporary_expires_at IS NULL OR neighbour.temporary_expires_at<=now()))
 OR NOT EXISTS(SELECT 1 FROM public.afroloc_validations WHERE afroloc_record_id=neighbour.id AND validation_method IN ('authority','witness'))
 OR target.geo_lat IS NULL OR target.geo_lon IS NULL OR neighbour.geo_lat IS NULL OR neighbour.geo_lon IS NULL THEN
  RETURN jsonb_build_object('ok',false,'error','É necessária uma testemunha distinta, com morada AFROLOC validada e localização disponível.');
 END IF;
 distance_m:=6371000*2*asin(sqrt(least(1.0,power(sin(radians(neighbour.geo_lat-target.geo_lat)/2),2)+cos(radians(target.geo_lat))*cos(radians(neighbour.geo_lat))*power(sin(radians(neighbour.geo_lon-target.geo_lon)/2),2))));
 IF distance_m>100 THEN RETURN jsonb_build_object('ok',false,'error','A testemunha deve residir até 100 metros deste endereço.'); END IF;
 IF p_action='request' THEN
  IF p_payload->>'consent'<>'true' OR p_payload->>'consent' IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Confirme o envio do pedido.'); END IF;
  SELECT * INTO witness FROM public.afroloc_witnesses WHERE afroloc_record_id=target.id AND witness_user_id=neighbour.user_id ORDER BY created_at LIMIT 1;
  IF witness.id IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'witness_id',witness.id,'status',witness.status,'existing',true); END IF;
  IF (SELECT count(DISTINCT witness_user_id) FROM public.afroloc_witnesses WHERE afroloc_record_id=target.id AND status IN ('pending','confirmed'))>=3 THEN
   RETURN jsonb_build_object('ok',false,'error','Já foram indicadas três testemunhas.');
  END IF;
  INSERT INTO public.afroloc_witnesses(afroloc_record_id,witness_user_id,witness_afro_id,status,confirmation_protocol)
  VALUES(target.id,neighbour.user_id,neighbour.code,'pending','otp_v2') RETURNING id INTO wid;
  INSERT INTO public.afroloc_witness_events(actor_id,witness_id,action) VALUES(p_actor,wid,'requested');
  RETURN jsonb_build_object('ok',true,'witness_id',wid,'status','pending','existing',false);
 END IF;
 IF witness.status<>'pending' THEN RETURN jsonb_build_object('ok',false,'error','Este testemunho já foi concluído.'); END IF;
 IF p_action='prepare' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('witness-send:'||p_actor::text,0));
  SELECT * INTO challenge FROM public.afroloc_witness_challenges WHERE witness_id=witness.id FOR UPDATE;
  IF challenge.last_sent_at>now()-interval '60 seconds' OR (SELECT count(*) FROM public.afroloc_witness_events WHERE actor_id=p_actor AND action='otp_prepared' AND created_at>now()-interval '1 hour')>=10 THEN
   RETURN jsonb_build_object('ok',false,'error','Aguarde antes de pedir outro código.');
  END IF;
  SELECT phone INTO phone_number FROM public.account_verified_phones WHERE user_id=witness.witness_user_id AND revoked_at IS NULL AND expires_at>now() ORDER BY verified_at DESC LIMIT 1;
  IF phone_number IS NULL THEN phone_number:=p_payload->>'auth_verified_phone'; END IF;
  phone_number:='+'||regexp_replace(coalesce(phone_number,''),'[^0-9]','','g');
  IF phone_number !~ '^\+244[0-9]{9}$' THEN RETURN jsonb_build_object('ok',false,'reason','phone_not_verified','error','A testemunha precisa de confirmar um número angolano na sua conta AFROLOC antes de receber o código.'); END IF;
  IF p_payload->>'otp_hash' !~ '^[a-f0-9]{64}$' OR length(p_payload->>'salt')<>36 THEN RETURN jsonb_build_object('ok',false,'error','Desafio inválido.'); END IF;
  INSERT INTO public.afroloc_witness_challenges(witness_id,otp_hash,salt,expires_at) VALUES(witness.id,p_payload->>'otp_hash',p_payload->>'salt',now()+interval '10 minutes')
  ON CONFLICT(witness_id) DO UPDATE SET challenge_id=gen_random_uuid(),otp_hash=excluded.otp_hash,salt=excluded.salt,expires_at=excluded.expires_at,attempts=0,delivery_state='prepared',last_sent_at=now(),consumed_at=NULL RETURNING * INTO challenge;
  UPDATE public.afroloc_witnesses SET confirmation_protocol='otp_v2',otp_code=NULL,otp_expires_at=NULL,otp_sent_at=now() WHERE id=witness.id;
  INSERT INTO public.afroloc_witness_events(actor_id,witness_id,action) VALUES(p_actor,witness.id,'otp_prepared');
  RETURN jsonb_build_object('ok',true,'phone',phone_number,'challenge_id',challenge.challenge_id,'expires_at',challenge.expires_at,'afroloc_code',target.code);
 END IF;
 IF p_action='verify' THEN
  IF p_actor<>witness.witness_user_id THEN RETURN jsonb_build_object('ok',false,'error','Só a testemunha pode confirmar este pedido.'); END IF;
  IF p_payload->>'consent' IS DISTINCT FROM 'true' OR length(trim(coalesce(p_payload->>'full_name','')))<3 OR length(trim(coalesce(p_payload->>'signature','')))<3 THEN
   RETURN jsonb_build_object('ok',false,'error','Preencha o nome, a assinatura e a declaração.');
  END IF;
  SELECT * INTO challenge FROM public.afroloc_witness_challenges WHERE witness_id=witness.id FOR UPDATE;
  IF challenge.witness_id IS NULL OR challenge.delivery_state<>'sent' OR challenge.expires_at<=now() OR challenge.attempts>=5 THEN RETURN jsonb_build_object('ok',false,'error','Código indisponível, expirado ou bloqueado. Peça um novo código.'); END IF;
  IF p_payload->>'challenge_id' IS DISTINCT FROM challenge.challenge_id::text THEN RETURN jsonb_build_object('ok',false,'error','O código foi substituído. Utilize o mais recente.'); END IF;
  UPDATE public.afroloc_witness_challenges SET attempts=attempts+1 WHERE witness_id=witness.id;
  IF p_payload->>'otp_hash' IS DISTINCT FROM challenge.otp_hash THEN RETURN jsonb_build_object('ok',false,'error','Código incorrecto.'); END IF;
  decision:=coalesce(p_payload->>'decision','confirm');
  IF decision NOT IN ('confirm','reject') THEN RETURN jsonb_build_object('ok',false,'error','Decisão inválida.'); END IF;
  UPDATE public.afroloc_witness_challenges SET delivery_state='consumed',consumed_at=now() WHERE witness_id=witness.id;
  UPDATE public.afroloc_witnesses SET status=CASE WHEN decision='confirm' THEN 'confirmed' ELSE 'rejected' END,
   confirmed_at=CASE WHEN decision='confirm' THEN now() ELSE NULL END,
   signature=left(trim(p_payload->>'full_name'),160)||' — '||left(trim(p_payload->>'signature'),500),
   rejection_reason=CASE WHEN decision='reject' THEN 'A testemunha não confirmou a residência.' ELSE NULL END,
   otp_code=NULL,otp_expires_at=NULL WHERE id=witness.id;
  INSERT INTO public.afroloc_witness_events(actor_id,witness_id,action) VALUES(p_actor,witness.id,CASE WHEN decision='confirm' THEN 'confirmed' ELSE 'rejected' END);
  -- Deliberately no update to afroloc_records.status or official validated_at.
  RETURN jsonb_build_object('ok',true,'status',CASE WHEN decision='confirm' THEN 'confirmed' ELSE 'rejected' END,'witness_id',witness.id);
 END IF;
 RETURN jsonb_build_object('ok',false,'error','Operação desconhecida.');
END $$;
REVOKE ALL ON FUNCTION public.witness_confirmation_v2(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.witness_confirmation_v2(uuid,text,jsonb) TO service_role;

-- Activate the station already planned by AFROLOC, retaining its existing identifier.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.postal_stations WHERE station='5051500' AND municipio_code IN ('AO-LUA-TALATONA','AO-LDA-TALATONA')) THEN RAISE EXCEPTION 'Estação Talatona esperada não encontrada.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.administrative_divisions WHERE country_code='AO' AND code='AO-LDA-TALATONA' AND level=2 AND parent_code='AO-LDA') THEN RAISE EXCEPTION 'Catálogo Talatona não confirmado.'; END IF;
 UPDATE public.postal_stations SET province_code='AO-LDA',municipio_code='AO-LDA-TALATONA',name='Estação digital AFROLOC de Talatona',status='active',notes=concat_ws(E'\n',notes,'Activada em 09/11/2026 a pedido do responsável. Serviço de caixa postal digital AFROLOC; não declara a existência de um posto físico dos Correios. As inscrições da feira mantêm validação oficial pendente.'),updated_at=now() WHERE station='5051500';
END $$;
