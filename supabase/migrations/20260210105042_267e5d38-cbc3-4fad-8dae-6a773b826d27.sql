
-- Create yamioo_agent role value (add to user_roles if not using enum)
-- Since user_roles uses text role column, no enum change needed

-- Create yamioo_agents table with sequential numbering
CREATE TABLE public.yamioo_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  agent_number INTEGER NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by_user_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sequence for agent numbers
CREATE SEQUENCE public.yamioo_agent_number_seq START WITH 1 INCREMENT BY 1;

-- Set default for agent_number from sequence
ALTER TABLE public.yamioo_agents ALTER COLUMN agent_number SET DEFAULT nextval('public.yamioo_agent_number_seq');

-- Enable RLS
ALTER TABLE public.yamioo_agents ENABLE ROW LEVEL SECURITY;

-- Admins can manage agents
CREATE POLICY "Admins can manage yamioo agents"
  ON public.yamioo_agents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'admin_national')
    )
  );

-- Agents can read their own record
CREATE POLICY "Agents can view own record"
  ON public.yamioo_agents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to register a yamioo agent (auto-assigns role + number)
CREATE OR REPLACE FUNCTION public.register_yamioo_agent(
  p_user_id UUID,
  p_assigned_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.yamioo_agents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent public.yamioo_agents;
BEGIN
  -- Insert agent record (number auto-assigned by sequence)
  INSERT INTO public.yamioo_agents (user_id, assigned_by_user_id, notes)
  VALUES (p_user_id, p_assigned_by, p_notes)
  RETURNING * INTO v_agent;

  -- Assign yamioo_agent role if not already present
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'yamioo_agent')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN v_agent;
END;
$$;

-- Function to check if user is a yamioo agent
CREATE OR REPLACE FUNCTION public.is_yamioo_agent(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.yamioo_agents
    WHERE user_id = p_user_id AND is_active = true
  );
$$;

-- Trigger for updated_at
CREATE TRIGGER update_yamioo_agents_updated_at
  BEFORE UPDATE ON public.yamioo_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
