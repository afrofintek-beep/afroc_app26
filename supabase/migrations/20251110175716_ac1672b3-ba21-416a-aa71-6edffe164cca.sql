-- =====================================================
-- REDESIGN: Sistema de Hierarquia Administrativa
-- =====================================================

-- 1. Remover triggers antigos de cálculo automático
DROP TRIGGER IF EXISTS on_profile_updated ON profiles;
DROP TRIGGER IF EXISTS on_afroid_record_updated ON afroid_records;
DROP TRIGGER IF EXISTS on_witness_updated ON afroid_witnesses;
DROP TRIGGER IF EXISTS on_validation_created ON afroid_validations;

-- 2. Remover funções antigas de cálculo automático
DROP FUNCTION IF EXISTS trigger_update_authorization_level();
DROP FUNCTION IF EXISTS trigger_update_witness_authorization();
DROP FUNCTION IF EXISTS trigger_update_validation_authorization();
DROP FUNCTION IF EXISTS calculate_user_authorization_level(uuid);
DROP FUNCTION IF EXISTS update_user_authorization_level(uuid);

-- 3. Modificar tabela user_authorization_levels para hierarquia administrativa
ALTER TABLE user_authorization_levels
  DROP COLUMN IF EXISTS witness_count,
  DROP COLUMN IF EXISTS witness_success_rate,
  DROP COLUMN IF EXISTS validation_count,
  DROP COLUMN IF EXISTS account_age_days,
  DROP COLUMN IF EXISTS afroid_count,
  DROP COLUMN IF EXISTS level_achieved_at,
  DROP COLUMN IF EXISTS last_evaluated_at;

ALTER TABLE user_authorization_levels
  ADD COLUMN IF NOT EXISTS administrative_role text,
  ADD COLUMN IF NOT EXISTS jurisdiction_country text,
  ADD COLUMN IF NOT EXISTS jurisdiction_level1_code text,
  ADD COLUMN IF NOT EXISTS jurisdiction_level1_name text,
  ADD COLUMN IF NOT EXISTS jurisdiction_level2_code text,
  ADD COLUMN IF NOT EXISTS jurisdiction_level2_name text,
  ADD COLUMN IF NOT EXISTS jurisdiction_level3_code text,
  ADD COLUMN IF NOT EXISTS jurisdiction_level3_name text,
  ADD COLUMN IF NOT EXISTS jurisdiction_level4_code text,
  ADD COLUMN IF NOT EXISTS jurisdiction_level4_name text,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz DEFAULT now();

-- 4. Criar tabela registration_batches (pacotes de registros)
CREATE TABLE IF NOT EXISTS registration_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text UNIQUE NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_to_user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  jurisdiction_country text NOT NULL,
  jurisdiction_level1_code text,
  jurisdiction_level1_name text,
  jurisdiction_level2_code text,
  jurisdiction_level2_name text,
  jurisdiction_level3_code text,
  jurisdiction_level3_name text,
  jurisdiction_level4_code text,
  jurisdiction_level4_name text,
  record_count integer DEFAULT 0,
  notes text,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  approved_by_user_id uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- 5. Modificar tabela afroid_records para incluir batch e hierarquia
ALTER TABLE afroid_records
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES registration_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registered_by_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- 6. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_batches_created_by ON registration_batches(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_batches_submitted_to ON registration_batches(submitted_to_user_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON registration_batches(status);
CREATE INDEX IF NOT EXISTS idx_afroid_records_batch ON afroid_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_afroid_records_registered_by ON afroid_records(registered_by_user_id);

-- 7. RLS Policies para registration_batches
ALTER TABLE registration_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view batches they created"
  ON registration_batches FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can view batches submitted to them"
  ON registration_batches FOR SELECT
  USING (auth.uid() = submitted_to_user_id);

CREATE POLICY "Users can create their own batches"
  ON registration_batches FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own draft batches"
  ON registration_batches FOR UPDATE
  USING (auth.uid() = created_by_user_id AND status = 'draft');

CREATE POLICY "Superiors can update submitted batches"
  ON registration_batches FOR UPDATE
  USING (auth.uid() = submitted_to_user_id AND status = 'submitted');

CREATE POLICY "Admins can view all batches"
  ON registration_batches FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any batch"
  ON registration_batches FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- 8. Atualizar RLS policies de afroid_records
DROP POLICY IF EXISTS "Users can create their own records" ON afroid_records;

CREATE POLICY "Registered users can create records"
  ON afroid_records FOR INSERT
  WITH CHECK (auth.uid() = registered_by_user_id OR auth.uid() = user_id);

-- 9. Função para obter superior hierárquico
CREATE OR REPLACE FUNCTION get_superior_user_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_level integer;
  v_jurisdiction_country text;
  v_jurisdiction_level1 text;
  v_jurisdiction_level2 text;
  v_jurisdiction_level3 text;
  v_jurisdiction_level4 text;
  v_superior_id uuid;
BEGIN
  -- Get user's level and jurisdiction
  SELECT current_level, jurisdiction_country, 
         jurisdiction_level1_code, jurisdiction_level2_code,
         jurisdiction_level3_code, jurisdiction_level4_code
  INTO v_user_level, v_jurisdiction_country,
       v_jurisdiction_level1, v_jurisdiction_level2,
       v_jurisdiction_level3, v_jurisdiction_level4
  FROM user_authorization_levels
  WHERE user_id = _user_id;

  -- Find superior (one level up in same jurisdiction)
  IF v_user_level = 1 THEN
    -- Level 1 reports to Level 2 in same level2 area
    SELECT user_id INTO v_superior_id
    FROM user_authorization_levels
    WHERE current_level = 2
      AND jurisdiction_country = v_jurisdiction_country
      AND jurisdiction_level1_code = v_jurisdiction_level1
      AND jurisdiction_level2_code = v_jurisdiction_level2
    LIMIT 1;
  ELSIF v_user_level = 2 THEN
    -- Level 2 reports to Level 3 in same level3 area
    SELECT user_id INTO v_superior_id
    FROM user_authorization_levels
    WHERE current_level = 3
      AND jurisdiction_country = v_jurisdiction_country
      AND jurisdiction_level1_code = v_jurisdiction_level1
      AND jurisdiction_level2_code = v_jurisdiction_level2
      AND jurisdiction_level3_code = v_jurisdiction_level3
    LIMIT 1;
  ELSIF v_user_level = 3 THEN
    -- Level 3 reports to Level 4 in same level4 area
    SELECT user_id INTO v_superior_id
    FROM user_authorization_levels
    WHERE current_level = 4
      AND jurisdiction_country = v_jurisdiction_country
      AND jurisdiction_level1_code = v_jurisdiction_level1
      AND jurisdiction_level2_code = v_jurisdiction_level2
      AND jurisdiction_level3_code = v_jurisdiction_level3
      AND jurisdiction_level4_code = v_jurisdiction_level4
    LIMIT 1;
  ELSIF v_user_level = 4 THEN
    -- Level 4 reports to Level 5 (national)
    SELECT user_id INTO v_superior_id
    FROM user_authorization_levels
    WHERE current_level = 5
      AND jurisdiction_country = v_jurisdiction_country
    LIMIT 1;
  END IF;

  RETURN v_superior_id;
END;
$$;

-- 10. Função para verificar se pode validar pacote
CREATE OR REPLACE FUNCTION can_validate_batch(_user_id uuid, _batch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_submitted_to uuid;
BEGIN
  SELECT submitted_to_user_id INTO v_batch_submitted_to
  FROM registration_batches
  WHERE id = _batch_id;
  
  RETURN v_batch_submitted_to = _user_id OR has_role(_user_id, 'admin');
END;
$$;

-- 11. Trigger para atualizar updated_at em batches
CREATE TRIGGER update_batches_updated_at
  BEFORE UPDATE ON registration_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 12. Função para gerar número de lote automático
CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text;
  v_count integer;
  v_batch_number text;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM registration_batches
  WHERE batch_number LIKE v_year || '%';
  
  v_batch_number := v_year || '-' || LPAD(v_count::text, 6, '0');
  
  RETURN v_batch_number;
END;
$$;