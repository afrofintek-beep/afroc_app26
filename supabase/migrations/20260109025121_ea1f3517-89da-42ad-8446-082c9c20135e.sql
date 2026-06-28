-- ===========================================
-- MÓDULO DE MULTAS AFROLOC - FASE 1: FUNDAÇÃO
-- ===========================================

-- 1. ENUM para tipos de infrações
CREATE TYPE public.violation_category AS ENUM (
  'transito',
  'transporte',
  'municipal',
  'ambiental',
  'comercial'
);

-- 2. ENUM para status de multas
CREATE TYPE public.fine_status AS ENUM (
  'draft',
  'issued',
  'notified',
  'paid',
  'overdue',
  'appealed',
  'canceled',
  'enforced'
);

-- 3. ENUM para tipo de coletor
CREATE TYPE public.collector_type AS ENUM (
  'agent',
  'radar',
  'system',
  'camera'
);

-- 4. ENUM para tipo geográfico
CREATE TYPE public.geo_type AS ENUM (
  'point',
  'segment',
  'area'
);

-- 5. Tabela de códigos de infração (lookup table)
CREATE TABLE public.violation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  category violation_category NOT NULL,
  description TEXT NOT NULL,
  legal_basis_ref TEXT,
  base_amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'AOA',
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  discount_days INTEGER DEFAULT 15,
  points INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_user_id UUID REFERENCES auth.users(id)
);

-- 6. Tabela de instituições emissoras
CREATE TABLE public.fine_institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  level1_code VARCHAR(20),
  level1_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  logo_path TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. EVENTOS DE INFRAÇÃO (imutável - event sourcing)
CREATE TABLE public.violation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(50) UNIQUE NOT NULL,
  institution_id UUID REFERENCES public.fine_institutions(id),
  collector_type collector_type NOT NULL,
  collector_user_id UUID REFERENCES auth.users(id),
  
  -- Timestamp e localização
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat DECIMAL(10, 7) NOT NULL,
  lon DECIMAL(10, 7) NOT NULL,
  accuracy_meters DECIMAL(8, 2),
  
  -- Resolução AfroLoc
  afroloc_id UUID REFERENCES public.afroloc_records(id),
  afroloc_code TEXT,
  geo_type geo_type DEFAULT 'point',
  geo_confidence_score DECIMAL(5, 2),
  
  -- Infração
  violation_category violation_category NOT NULL,
  violation_code_id UUID REFERENCES public.violation_codes(id) NOT NULL,
  
  -- Evidências
  evidence_bundle_id UUID,
  evidence_photo_paths TEXT[],
  evidence_video_paths TEXT[],
  
  -- Sujeito (dados capturados no momento)
  subject_type VARCHAR(20), -- pessoa, empresa, viatura, operador
  subject_plate VARCHAR(20),
  subject_document_type VARCHAR(20),
  subject_document_number VARCHAR(50),
  
  -- Integridade
  device_info JSONB,
  raw_data JSONB,
  hash_sha256 VARCHAR(64) NOT NULL,
  
  -- Metadados
  notes TEXT,
  is_synced BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint para imutabilidade (sem updates após sync)
  CONSTRAINT violation_events_immutable CHECK (
    (is_synced = false) OR 
    (is_synced = true AND synced_at IS NOT NULL)
  )
);

-- 8. MULTAS (workflow)
CREATE TABLE public.fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fine_number VARCHAR(30) UNIQUE NOT NULL,
  
  -- Referência ao evento
  violation_event_id UUID REFERENCES public.violation_events(id) NOT NULL,
  institution_id UUID REFERENCES public.fine_institutions(id) NOT NULL,
  
  -- Sujeito da multa
  subject_type VARCHAR(20) NOT NULL,
  subject_ref TEXT NOT NULL, -- NIF/BI/matrícula (mascarado em queries públicas)
  subject_name TEXT,
  subject_address TEXT,
  subject_phone TEXT,
  subject_email TEXT,
  
  -- Valores
  base_amount DECIMAL(12, 2) NOT NULL,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  penalty_amount DECIMAL(12, 2) DEFAULT 0,
  final_amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'AOA',
  
  -- Datas
  issue_date DATE,
  due_date DATE,
  discount_deadline DATE,
  
  -- Status e workflow
  status fine_status DEFAULT 'draft',
  status_updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Actors
  created_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  issued_by_user_id UUID REFERENCES auth.users(id),
  approved_by_user_id UUID REFERENCES auth.users(id),
  canceled_by_user_id UUID REFERENCES auth.users(id),
  
  -- Razões
  cancellation_reason TEXT,
  cancellation_date TIMESTAMPTZ,
  
  -- Referência de pagamento
  payment_reference VARCHAR(50),
  payment_entity VARCHAR(20),
  
  -- Metadados
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. LOG DE AUDITORIA (append-only com hash chain)
CREATE TABLE public.fine_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_sequence BIGSERIAL,
  
  -- Actor
  actor_user_id UUID REFERENCES auth.users(id),
  actor_institution_id UUID REFERENCES public.fine_institutions(id),
  actor_role TEXT,
  actor_ip_address INET,
  actor_user_agent TEXT,
  
  -- Ação
  action VARCHAR(50) NOT NULL,
  object_type VARCHAR(30) NOT NULL, -- violation_event, fine, evidence, notification
  object_id UUID NOT NULL,
  
  -- Detalhes
  old_values JSONB,
  new_values JSONB,
  result VARCHAR(10) DEFAULT 'OK', -- OK, FAIL, DENIED
  error_message TEXT,
  
  -- Hash chain para imutabilidade
  hash_chain_prev VARCHAR(64),
  hash_chain_curr VARCHAR(64) NOT NULL,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint: append-only (no updates/deletes via policy)
  CONSTRAINT audit_log_result_check CHECK (result IN ('OK', 'FAIL', 'DENIED'))
);

-- 10. Função para gerar hash do evento
CREATE OR REPLACE FUNCTION public.generate_violation_event_hash(
  p_event_id TEXT,
  p_lat DECIMAL,
  p_lon DECIMAL,
  p_timestamp TIMESTAMPTZ,
  p_violation_code TEXT,
  p_collector_type TEXT
) RETURNS VARCHAR(64)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data TEXT;
BEGIN
  v_data := p_event_id || '|' || 
            p_lat::TEXT || '|' || 
            p_lon::TEXT || '|' || 
            p_timestamp::TEXT || '|' || 
            p_violation_code || '|' || 
            p_collector_type;
  RETURN encode(sha256(v_data::bytea), 'hex');
END;
$$;

-- 11. Função para gerar hash chain do audit log
CREATE OR REPLACE FUNCTION public.generate_audit_hash_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_hash VARCHAR(64);
  v_data TEXT;
BEGIN
  -- Obter hash anterior
  SELECT hash_chain_curr INTO v_prev_hash
  FROM public.fine_audit_log
  ORDER BY log_sequence DESC
  LIMIT 1;
  
  -- Se não existe anterior, usar hash de inicialização
  IF v_prev_hash IS NULL THEN
    v_prev_hash := encode(sha256('AFROLOC_FINES_GENESIS'::bytea), 'hex');
  END IF;
  
  NEW.hash_chain_prev := v_prev_hash;
  
  -- Gerar hash atual
  v_data := v_prev_hash || '|' || 
            NEW.actor_user_id::TEXT || '|' || 
            NEW.action || '|' || 
            NEW.object_type || '|' || 
            NEW.object_id::TEXT || '|' || 
            NEW.created_at::TEXT;
  
  NEW.hash_chain_curr := encode(sha256(v_data::bytea), 'hex');
  
  RETURN NEW;
END;
$$;

-- 12. Trigger para hash chain automático
CREATE TRIGGER trg_audit_hash_chain
  BEFORE INSERT ON public.fine_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_audit_hash_chain();

-- 13. Função para registar auditoria (helper)
CREATE OR REPLACE FUNCTION public.log_fine_audit(
  p_action VARCHAR(50),
  p_object_type VARCHAR(30),
  p_object_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_result VARCHAR(10) DEFAULT 'OK'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID;
  v_role TEXT;
BEGIN
  v_user_id := auth.uid();
  
  -- Obter role do utilizador
  SELECT role::TEXT INTO v_role
  FROM public.user_roles
  WHERE user_id = v_user_id
  LIMIT 1;
  
  INSERT INTO public.fine_audit_log (
    actor_user_id,
    actor_role,
    action,
    object_type,
    object_id,
    old_values,
    new_values,
    result
  ) VALUES (
    v_user_id,
    v_role,
    p_action,
    p_object_type,
    p_object_id,
    p_old_values,
    p_new_values,
    p_result
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 14. Função para gerar número de multa
CREATE OR REPLACE FUNCTION public.generate_fine_number(p_institution_code VARCHAR)
RETURNS VARCHAR(30)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year VARCHAR(4);
  v_seq INTEGER;
  v_number VARCHAR(30);
BEGIN
  v_year := to_char(now(), 'YYYY');
  
  -- Contar multas do ano para esta instituição
  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.fines f
  JOIN public.fine_institutions i ON f.institution_id = i.id
  WHERE i.code = p_institution_code
    AND EXTRACT(YEAR FROM f.created_at) = EXTRACT(YEAR FROM now());
  
  v_number := p_institution_code || '-' || v_year || '-' || lpad(v_seq::TEXT, 7, '0');
  
  RETURN v_number;
END;
$$;

-- 15. Trigger para atualizar updated_at em fines
CREATE OR REPLACE FUNCTION public.update_fine_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fines_updated_at
  BEFORE UPDATE ON public.fines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fine_updated_at();

-- 16. Índices para performance
CREATE INDEX idx_violation_events_institution ON public.violation_events(institution_id);
CREATE INDEX idx_violation_events_collector ON public.violation_events(collector_user_id);
CREATE INDEX idx_violation_events_timestamp ON public.violation_events(event_timestamp DESC);
CREATE INDEX idx_violation_events_category ON public.violation_events(violation_category);
CREATE INDEX idx_violation_events_afroloc ON public.violation_events(afroloc_id);
CREATE INDEX idx_violation_events_synced ON public.violation_events(is_synced) WHERE is_synced = false;

CREATE INDEX idx_fines_institution ON public.fines(institution_id);
CREATE INDEX idx_fines_status ON public.fines(status);
CREATE INDEX idx_fines_subject ON public.fines(subject_ref);
CREATE INDEX idx_fines_created_by ON public.fines(created_by_user_id);
CREATE INDEX idx_fines_due_date ON public.fines(due_date);
CREATE INDEX idx_fines_payment_ref ON public.fines(payment_reference);

CREATE INDEX idx_audit_log_actor ON public.fine_audit_log(actor_user_id);
CREATE INDEX idx_audit_log_object ON public.fine_audit_log(object_type, object_id);
CREATE INDEX idx_audit_log_action ON public.fine_audit_log(action);
CREATE INDEX idx_audit_log_created ON public.fine_audit_log(created_at DESC);

-- 17. Enable RLS
ALTER TABLE public.violation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fine_institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.violation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fine_audit_log ENABLE ROW LEVEL SECURITY;

-- 18. Função helper para verificar roles de multas
CREATE OR REPLACE FUNCTION public.has_fines_role(_user_id uuid, _role_check text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        (_role_check = 'admin' AND role IN ('admin', 'admin_national', 'admin_province', 'admin_municipality')) OR
        (_role_check = 'operator' AND role IN ('operator_field', 'admin', 'admin_national', 'admin_province', 'admin_municipality')) OR
        (_role_check = 'auditor' AND role = 'auditor_read')
      )
  )
$$;

-- 19. RLS Policies - violation_codes (public read, admin write)
CREATE POLICY "Anyone can read active violation codes"
  ON public.violation_codes FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage violation codes"
  ON public.violation_codes FOR ALL
  TO authenticated
  USING (public.has_fines_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_fines_role(auth.uid(), 'admin'));

-- 20. RLS Policies - fine_institutions (public read, admin write)
CREATE POLICY "Anyone can read active institutions"
  ON public.fine_institutions FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage institutions"
  ON public.fine_institutions FOR ALL
  TO authenticated
  USING (public.has_fines_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_fines_role(auth.uid(), 'admin'));

-- 21. RLS Policies - violation_events
CREATE POLICY "Agents can insert violation events"
  ON public.violation_events FOR INSERT
  TO authenticated
  WITH CHECK (collector_user_id = auth.uid());

CREATE POLICY "Agents can view own events"
  ON public.violation_events FOR SELECT
  TO authenticated
  USING (
    collector_user_id = auth.uid() OR
    public.has_fines_role(auth.uid(), 'admin') OR
    public.has_fines_role(auth.uid(), 'operator')
  );

CREATE POLICY "Agents can update own unsynced events"
  ON public.violation_events FOR UPDATE
  TO authenticated
  USING (collector_user_id = auth.uid() AND is_synced = false)
  WITH CHECK (collector_user_id = auth.uid() AND is_synced = false);

-- 22. RLS Policies - fines
CREATE POLICY "Authorized users can create fines"
  ON public.fines FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by_user_id = auth.uid() AND
    public.has_fines_role(auth.uid(), 'operator')
  );

CREATE POLICY "Users can view authorized fines"
  ON public.fines FOR SELECT
  TO authenticated
  USING (
    created_by_user_id = auth.uid() OR
    issued_by_user_id = auth.uid() OR
    public.has_fines_role(auth.uid(), 'admin') OR
    public.has_fines_role(auth.uid(), 'operator') OR
    public.has_fines_role(auth.uid(), 'auditor')
  );

CREATE POLICY "Authorized users can update fines"
  ON public.fines FOR UPDATE
  TO authenticated
  USING (
    public.has_fines_role(auth.uid(), 'admin') OR
    (created_by_user_id = auth.uid() AND status = 'draft')
  )
  WITH CHECK (
    public.has_fines_role(auth.uid(), 'admin') OR
    (created_by_user_id = auth.uid() AND status = 'draft')
  );

-- 23. RLS Policies - fine_audit_log (append-only, read for auditors)
CREATE POLICY "System can insert audit logs"
  ON public.fine_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Auditors can read audit logs"
  ON public.fine_audit_log FOR SELECT
  TO authenticated
  USING (
    public.has_fines_role(auth.uid(), 'admin') OR
    public.has_fines_role(auth.uid(), 'auditor')
  );

-- NO UPDATE OR DELETE policies for audit_log (append-only)

-- 24. Inserir códigos de infração de trânsito básicos
INSERT INTO public.violation_codes (code, category, description, legal_basis_ref, base_amount, discount_percentage, discount_days, points) VALUES
  ('TRANS001', 'transito', 'Excesso de velocidade até 20 km/h', 'Código de Estrada Art. 27', 15000.00, 25, 15, 2),
  ('TRANS002', 'transito', 'Excesso de velocidade 20-40 km/h', 'Código de Estrada Art. 27', 35000.00, 25, 15, 4),
  ('TRANS003', 'transito', 'Excesso de velocidade > 40 km/h', 'Código de Estrada Art. 27', 75000.00, 0, 0, 6),
  ('TRANS004', 'transito', 'Estacionamento proibido', 'Código de Estrada Art. 48', 10000.00, 25, 15, 1),
  ('TRANS005', 'transito', 'Avanço de sinal vermelho', 'Código de Estrada Art. 31', 45000.00, 25, 15, 4),
  ('TRANS006', 'transito', 'Condução sem carta válida', 'Código de Estrada Art. 121', 100000.00, 0, 0, 6),
  ('TRANS007', 'transito', 'Uso de telemóvel durante condução', 'Código de Estrada Art. 84', 25000.00, 25, 15, 3),
  ('TRANS008', 'transito', 'Não uso de cinto de segurança', 'Código de Estrada Art. 82', 15000.00, 25, 15, 2),
  ('TRANS009', 'transito', 'Condução sob efeito de álcool', 'Código de Estrada Art. 81', 150000.00, 0, 0, 6),
  ('TRANS010', 'transito', 'Ultrapassagem perigosa', 'Código de Estrada Art. 35', 50000.00, 25, 15, 4);

-- 25. Inserir instituições de exemplo
INSERT INTO public.fine_institutions (code, name, country_code, level1_code, level1_name) VALUES
  ('DPVT-LUA', 'Direcção Provincial de Viação e Trânsito de Luanda', 'AO', 'LUA', 'Luanda'),
  ('DPVT-BGU', 'Direcção Provincial de Viação e Trânsito de Benguela', 'AO', 'BGU', 'Benguela'),
  ('DPVT-HUI', 'Direcção Provincial de Viação e Trânsito de Huíla', 'AO', 'HUI', 'Huíla');