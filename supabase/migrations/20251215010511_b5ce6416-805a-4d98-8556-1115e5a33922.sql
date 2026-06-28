-- Create roles metadata table
CREATE TABLE IF NOT EXISTS public.roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Anyone can read roles
CREATE POLICY "Anyone can view roles" ON public.roles
  FOR SELECT USING (true);

-- Only admins can manage roles
CREATE POLICY "Admins can manage roles" ON public.roles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert role descriptions
INSERT INTO public.roles(name, description) VALUES
  ('admin', 'Administrador legado do sistema'),
  ('admin_national', 'Administração nacional: configurações, docs, polígonos, utilizadores'),
  ('admin_province', 'Administração provincial: KPIs e relatórios por província'),
  ('admin_municipality', 'Administração municipal: KPIs e relatórios por município'),
  ('operator_field', 'Operador de campo: criação/edição de locais'),
  ('auditor_read', 'Auditor/DFI: leitura e exportação'),
  ('moderator', 'Moderador do sistema'),
  ('citizen', 'Cidadão comum'),
  ('user', 'Utilizador básico')
ON CONFLICT (name) DO NOTHING;