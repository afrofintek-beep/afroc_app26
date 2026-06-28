-- =============================================
-- SISTEMA DE CO-RESIDENTES AFROLOC
-- Validação por autoridades com documentos obrigatórios
-- =============================================

-- Enum para tipo de relação com o endereço
CREATE TYPE public.resident_relationship AS ENUM (
  'owner',           -- Proprietário
  'tenant',          -- Inquilino (requer contrato)
  'spouse',          -- Cônjuge
  'child',           -- Filho/a
  'parent',          -- Pai/Mãe
  'sibling',         -- Irmão/Irmã
  'other_family',    -- Outro familiar
  'cohabitant'       -- Coabitante
);

-- Enum para status do pedido de co-residência
CREATE TYPE public.coresident_request_status AS ENUM (
  'pending_primary',      -- Aguarda aprovação do residente principal
  'pending_documents',    -- Aguarda upload de documentos
  'pending_authority',    -- Aguarda validação por autoridade
  'approved',             -- Aprovado
  'rejected',             -- Rejeitado
  'expired',              -- Expirado (não validado a tempo)
  'revoked'               -- Revogado
);

-- Enum para tipo de documento obrigatório
CREATE TYPE public.resident_document_type AS ENUM (
  'identity_card',        -- Bilhete de Identidade
  'passport',             -- Passaporte
  'birth_certificate',    -- Certidão de Nascimento
  'marriage_certificate', -- Certidão de Casamento
  'rental_contract',      -- Contrato de Arrendamento
  'property_deed',        -- Escritura de Propriedade
  'residence_declaration' -- Declaração de Residência
);

-- =============================================
-- Tabela: Configuração de capacidade por endereço
-- =============================================
CREATE TABLE public.afroloc_residence_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  afroloc_record_id UUID NOT NULL REFERENCES public.afroloc_records(id) ON DELETE CASCADE,
  
  -- Capacidade máxima definida pelo proprietário
  max_residents INTEGER NOT NULL DEFAULT 6,
  
  -- Documentos obrigatórios para cada tipo de relação (JSON)
  required_documents JSONB NOT NULL DEFAULT '{
    "owner": ["identity_card", "property_deed"],
    "tenant": ["identity_card", "rental_contract"],
    "spouse": ["identity_card", "marriage_certificate"],
    "child": ["identity_card"],
    "parent": ["identity_card"],
    "sibling": ["identity_card"],
    "other_family": ["identity_card", "residence_declaration"],
    "cohabitant": ["identity_card", "residence_declaration"]
  }'::jsonb,
  
  -- Quem configurou
  configured_by_user_id UUID NOT NULL,
  configured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_residence_config UNIQUE(afroloc_record_id)
);

-- =============================================
-- Tabela: Residentes do endereço
-- =============================================
CREATE TABLE public.afroloc_residents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  afroloc_record_id UUID NOT NULL REFERENCES public.afroloc_records(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Tipo de residente
  relationship public.resident_relationship NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  
  -- Status
  status public.coresident_request_status NOT NULL DEFAULT 'pending_primary',
  
  -- Aprovações
  primary_approved_at TIMESTAMP WITH TIME ZONE,
  primary_approved_by_user_id UUID,
  authority_approved_at TIMESTAMP WITH TIME ZONE,
  authority_approved_by_user_id UUID,
  authority_role TEXT,
  authority_notes TEXT,
  
  -- Rejeição/Revogação
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejected_by_user_id UUID,
  rejection_reason TEXT,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by_user_id UUID,
  revocation_reason TEXT,
  
  -- OTP para confirmação
  otp_code TEXT,
  otp_expires_at TIMESTAMP WITH TIME ZONE,
  otp_attempts INTEGER DEFAULT 0,
  
  -- Validade do registo (para inquilinos baseado no contrato)
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Um utilizador só pode ter um registo ativo por endereço
  CONSTRAINT unique_user_per_address UNIQUE(afroloc_record_id, user_id)
);

-- =============================================
-- Tabela: Documentos dos residentes
-- =============================================
CREATE TABLE public.afroloc_resident_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resident_id UUID NOT NULL REFERENCES public.afroloc_residents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Tipo e ficheiro
  document_type public.resident_document_type NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Número do documento (BI, passaporte, etc.)
  document_number TEXT,
  
  -- Validade do documento
  issue_date DATE,
  expiry_date DATE,
  
  -- Validação por autoridade
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by_user_id UUID,
  verification_notes TEXT,
  rejection_reason TEXT,
  
  -- Alerta de expiração enviado
  expiry_alert_sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- Tabela: Audit log específico para co-residentes
-- =============================================
CREATE TABLE public.afroloc_resident_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resident_id UUID REFERENCES public.afroloc_residents(id) ON DELETE SET NULL,
  afroloc_record_id UUID REFERENCES public.afroloc_records(id) ON DELETE SET NULL,
  
  -- Actor
  actor_user_id UUID,
  actor_role TEXT,
  actor_ip_address INET,
  actor_user_agent TEXT,
  
  -- Ação
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- Índices para performance
-- =============================================
CREATE INDEX idx_residents_afroloc ON public.afroloc_residents(afroloc_record_id);
CREATE INDEX idx_residents_user ON public.afroloc_residents(user_id);
CREATE INDEX idx_residents_status ON public.afroloc_residents(status);
CREATE INDEX idx_residents_valid_until ON public.afroloc_residents(valid_until) WHERE valid_until IS NOT NULL;
CREATE INDEX idx_resident_docs_resident ON public.afroloc_resident_documents(resident_id);
CREATE INDEX idx_resident_docs_expiry ON public.afroloc_resident_documents(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_resident_audit_resident ON public.afroloc_resident_audit_log(resident_id);
CREATE INDEX idx_resident_audit_afroloc ON public.afroloc_resident_audit_log(afroloc_record_id);

-- =============================================
-- Enable RLS
-- =============================================
ALTER TABLE public.afroloc_residence_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afroloc_residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afroloc_resident_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afroloc_resident_audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies: afroloc_residence_config
-- =============================================
CREATE POLICY "Users can view config of their addresses"
ON public.afroloc_residence_config FOR SELECT
USING (
  afroloc_record_id IN (
    SELECT id FROM public.afroloc_records WHERE user_id = auth.uid()
  )
  OR
  afroloc_record_id IN (
    SELECT afroloc_record_id FROM public.afroloc_residents WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Primary residents can update config"
ON public.afroloc_residence_config FOR UPDATE
USING (configured_by_user_id = auth.uid());

CREATE POLICY "Address owners can create config"
ON public.afroloc_residence_config FOR INSERT
WITH CHECK (
  afroloc_record_id IN (
    SELECT id FROM public.afroloc_records WHERE user_id = auth.uid()
  )
);

-- =============================================
-- RLS Policies: afroloc_residents
-- =============================================
CREATE POLICY "Users can view residents of their address"
ON public.afroloc_residents FOR SELECT
USING (
  user_id = auth.uid()
  OR
  afroloc_record_id IN (
    SELECT id FROM public.afroloc_records WHERE user_id = auth.uid()
  )
  OR
  afroloc_record_id IN (
    SELECT afroloc_record_id FROM public.afroloc_residents WHERE user_id = auth.uid() AND is_primary = true
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'admin_national', 'admin_province', 'admin_municipality', 'operator_field')
  )
);

CREATE POLICY "Users can request to join an address"
ON public.afroloc_residents FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Primary residents and authorities can update"
ON public.afroloc_residents FOR UPDATE
USING (
  user_id = auth.uid()
  OR
  afroloc_record_id IN (
    SELECT id FROM public.afroloc_records WHERE user_id = auth.uid()
  )
  OR
  afroloc_record_id IN (
    SELECT afroloc_record_id FROM public.afroloc_residents WHERE user_id = auth.uid() AND is_primary = true
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'admin_national', 'admin_province', 'admin_municipality', 'operator_field')
  )
);

-- =============================================
-- RLS Policies: afroloc_resident_documents
-- =============================================
CREATE POLICY "Users can view their documents"
ON public.afroloc_resident_documents FOR SELECT
USING (
  user_id = auth.uid()
  OR
  resident_id IN (
    SELECT id FROM public.afroloc_residents 
    WHERE afroloc_record_id IN (
      SELECT id FROM public.afroloc_records WHERE user_id = auth.uid()
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'admin_national', 'admin_province', 'admin_municipality', 'operator_field')
  )
);

CREATE POLICY "Users can upload their documents"
ON public.afroloc_resident_documents FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authorities can update document status"
ON public.afroloc_resident_documents FOR UPDATE
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'admin_national', 'admin_province', 'admin_municipality', 'operator_field')
  )
);

-- =============================================
-- RLS Policies: afroloc_resident_audit_log
-- =============================================
CREATE POLICY "Authorities can view audit logs"
ON public.afroloc_resident_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'admin_national', 'admin_province', 'admin_municipality', 'auditor_read')
  )
);

CREATE POLICY "System can insert audit logs"
ON public.afroloc_resident_audit_log FOR INSERT
WITH CHECK (true);

-- =============================================
-- Trigger: Auto-update timestamps
-- =============================================
CREATE TRIGGER update_residence_config_updated_at
BEFORE UPDATE ON public.afroloc_residence_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_residents_updated_at
BEFORE UPDATE ON public.afroloc_residents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_resident_docs_updated_at
BEFORE UPDATE ON public.afroloc_resident_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Function: Verificar capacidade antes de adicionar residente
-- =============================================
CREATE OR REPLACE FUNCTION public.check_residence_capacity()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Contar residentes ativos
  SELECT COUNT(*) INTO current_count
  FROM public.afroloc_residents
  WHERE afroloc_record_id = NEW.afroloc_record_id
    AND status IN ('approved', 'pending_primary', 'pending_documents', 'pending_authority');

  -- Obter limite máximo
  SELECT COALESCE(max_residents, 6) INTO max_allowed
  FROM public.afroloc_residence_config
  WHERE afroloc_record_id = NEW.afroloc_record_id;

  IF max_allowed IS NULL THEN
    max_allowed := 6; -- Default
  END IF;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Capacidade máxima de residentes atingida (% de %)', current_count, max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER check_capacity_before_insert
BEFORE INSERT ON public.afroloc_residents
FOR EACH ROW EXECUTE FUNCTION public.check_residence_capacity();

-- =============================================
-- Function: Audit log automático
-- =============================================
CREATE OR REPLACE FUNCTION public.log_resident_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.afroloc_resident_audit_log (
      resident_id, afroloc_record_id, actor_user_id, action, new_values
    ) VALUES (
      NEW.id, NEW.afroloc_record_id, NEW.user_id, 'RESIDENT_REQUEST_CREATED',
      jsonb_build_object('relationship', NEW.relationship, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.afroloc_resident_audit_log (
        resident_id, afroloc_record_id, actor_user_id, action, old_values, new_values
      ) VALUES (
        NEW.id, NEW.afroloc_record_id, 
        COALESCE(NEW.authority_approved_by_user_id, NEW.primary_approved_by_user_id, NEW.rejected_by_user_id),
        CASE 
          WHEN NEW.status = 'approved' THEN 'RESIDENT_APPROVED'
          WHEN NEW.status = 'rejected' THEN 'RESIDENT_REJECTED'
          WHEN NEW.status = 'revoked' THEN 'RESIDENT_REVOKED'
          WHEN NEW.status = 'pending_authority' THEN 'PENDING_AUTHORITY_VALIDATION'
          ELSE 'STATUS_CHANGED'
        END,
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status, 'notes', NEW.authority_notes)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER log_resident_changes_trigger
AFTER INSERT OR UPDATE ON public.afroloc_residents
FOR EACH ROW EXECUTE FUNCTION public.log_resident_changes();

-- =============================================
-- View: Documentos a expirar (próximos 30 dias)
-- =============================================
CREATE OR REPLACE VIEW public.expiring_resident_documents AS
SELECT 
  rd.id,
  rd.resident_id,
  rd.document_type,
  rd.document_number,
  rd.expiry_date,
  rd.expiry_date - CURRENT_DATE AS days_until_expiry,
  r.user_id,
  r.afroloc_record_id,
  ar.code AS afroloc_code,
  p.full_name,
  p.phone
FROM public.afroloc_resident_documents rd
JOIN public.afroloc_residents r ON rd.resident_id = r.id
JOIN public.afroloc_records ar ON r.afroloc_record_id = ar.id
LEFT JOIN public.profiles p ON r.user_id = p.user_id
WHERE rd.expiry_date IS NOT NULL
  AND rd.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
  AND rd.status = 'verified'
  AND r.status = 'approved'
ORDER BY rd.expiry_date;

-- =============================================
-- View: Residentes por aprovar (para autoridades)
-- =============================================
CREATE OR REPLACE VIEW public.pending_resident_approvals AS
SELECT 
  r.id AS resident_id,
  r.afroloc_record_id,
  ar.code AS afroloc_code,
  ar.country,
  ar.level1_name AS province,
  ar.level2_name AS municipality,
  ar.level3_name AS commune,
  r.user_id,
  p.full_name,
  p.phone,
  r.relationship,
  r.status,
  r.created_at,
  r.primary_approved_at,
  (
    SELECT COUNT(*) FROM public.afroloc_resident_documents rd 
    WHERE rd.resident_id = r.id AND rd.status = 'pending'
  ) AS pending_documents,
  (
    SELECT COUNT(*) FROM public.afroloc_resident_documents rd 
    WHERE rd.resident_id = r.id AND rd.status = 'verified'
  ) AS verified_documents
FROM public.afroloc_residents r
JOIN public.afroloc_records ar ON r.afroloc_record_id = ar.id
LEFT JOIN public.profiles p ON r.user_id = p.user_id
WHERE r.status = 'pending_authority'
ORDER BY r.created_at;