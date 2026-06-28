-- =============================================
-- LIMPAR E RECRIAR INSTITUIÇÕES COM CÓDIGOS CORRECTOS
-- =============================================

-- Atualizar instituições existentes com códigos corretos das administrative_divisions
UPDATE public.fine_institutions SET level1_code = 'BGU' WHERE level1_code = 'BGU';
UPDATE public.fine_institutions SET level1_code = 'HUI' WHERE level1_code = 'HUI';
UPDATE public.fine_institutions SET level1_code = 'LUA' WHERE level1_code = 'LUA';

-- Remover instituições com códigos incorrectos
DELETE FROM public.fine_institutions WHERE level1_code NOT IN (
  SELECT DISTINCT code FROM public.administrative_divisions WHERE country_code = 'AO' AND level = 1
) AND level1_code IS NOT NULL;

-- Adicionar colunas para suporte multi-nível administrativo
ALTER TABLE public.fine_institutions 
ADD COLUMN IF NOT EXISTS level2_code TEXT,
ADD COLUMN IF NOT EXISTS level2_name TEXT,
ADD COLUMN IF NOT EXISTS level3_code TEXT,
ADD COLUMN IF NOT EXISTS level3_name TEXT,
ADD COLUMN IF NOT EXISTS institution_type TEXT DEFAULT 'provincial';

-- Inserir instituições alinhadas com administrative_divisions de Angola
-- Nível Nacional
INSERT INTO public.fine_institutions (code, name, country_code, level1_code, level1_name, institution_type, is_active) VALUES
('INTR-AO', 'Instituto Nacional de Trânsito e Segurança Rodoviária', 'AO', NULL, NULL, 'national', true),
('IGAE-AO', 'Inspecção Geral das Actividades Económicas', 'AO', NULL, NULL, 'national', true),
('IGA-AO', 'Inspecção Geral do Ambiente', 'AO', NULL, NULL, 'national', true),
('MINTRANS-AO', 'Ministério dos Transportes', 'AO', NULL, NULL, 'national', true)
ON CONFLICT (code) DO NOTHING;

-- Direcções Provinciais de Viação (todas as 18 províncias + Icolo e Bengo)
INSERT INTO public.fine_institutions (code, name, country_code, level1_code, level1_name, institution_type, is_active) 
SELECT 
  'DPVT-' || ad.code,
  'Direcção Provincial de Viação e Trânsito de ' || ad.name,
  'AO',
  ad.code,
  ad.name,
  'provincial',
  true
FROM public.administrative_divisions ad
WHERE ad.country_code = 'AO' AND ad.level = 1
ON CONFLICT (code) DO NOTHING;

-- Administrações Municipais (para todos os municípios de Luanda como exemplo)
INSERT INTO public.fine_institutions (code, name, country_code, level1_code, level1_name, level2_code, level2_name, institution_type, is_active) 
SELECT 
  'ADM-' || ad.code,
  'Administração Municipal de ' || ad.name,
  'AO',
  ad.parent_code,
  (SELECT name FROM public.administrative_divisions WHERE code = ad.parent_code AND country_code = 'AO' AND level = 1),
  ad.code,
  ad.name,
  'municipal',
  true
FROM public.administrative_divisions ad
WHERE ad.country_code = 'AO' AND ad.level = 2 AND ad.parent_code = 'LUA'
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- ACTUALIZAR violation_events PARA SUPORTE MULTI-PAÍS
-- =============================================

-- Adicionar referência ao país na tabela de eventos
ALTER TABLE public.violation_events 
ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'AO',
ADD COLUMN IF NOT EXISTS level1_code TEXT,
ADD COLUMN IF NOT EXISTS level1_name TEXT,
ADD COLUMN IF NOT EXISTS level2_code TEXT,
ADD COLUMN IF NOT EXISTS level2_name TEXT,
ADD COLUMN IF NOT EXISTS level3_code TEXT,
ADD COLUMN IF NOT EXISTS level3_name TEXT,
ADD COLUMN IF NOT EXISTS level4_code TEXT,
ADD COLUMN IF NOT EXISTS level4_name TEXT;

-- =============================================
-- ACTUALIZAR fines PARA INCLUIR JURISDIÇÃO
-- =============================================

ALTER TABLE public.fines
ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'AO',
ADD COLUMN IF NOT EXISTS jurisdiction_level1_code TEXT,
ADD COLUMN IF NOT EXISTS jurisdiction_level1_name TEXT,
ADD COLUMN IF NOT EXISTS jurisdiction_level2_code TEXT,
ADD COLUMN IF NOT EXISTS jurisdiction_level2_name TEXT;

-- =============================================
-- CRIAR TABELA DE CATEGORIAS DE INFRAÇÃO POR PAÍS
-- =============================================
CREATE TABLE IF NOT EXISTS public.violation_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  category_code TEXT NOT NULL,
  category_name TEXT NOT NULL,
  description TEXT,
  governing_institution_type TEXT, -- national, provincial, municipal
  legal_framework TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country_code, category_code)
);

-- Habilitar RLS
ALTER TABLE public.violation_categories ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública
CREATE POLICY "violation_categories_select" ON public.violation_categories
FOR SELECT USING (true);

-- Inserir categorias para Angola
INSERT INTO public.violation_categories (country_code, category_code, category_name, description, governing_institution_type, legal_framework) VALUES
('AO', 'transito', 'Trânsito', 'Infrações ao Código de Estrada', 'provincial', 'Código de Estrada de Angola'),
('AO', 'transporte', 'Transporte Público', 'Infrações à Lei dos Transportes', 'national', 'Lei dos Transportes Rodoviários'),
('AO', 'municipal', 'Municipal', 'Infrações às Posturas Municipais', 'municipal', 'Código de Posturas Municipais'),
('AO', 'ambiental', 'Ambiental', 'Infrações à legislação ambiental', 'national', 'Lei de Bases do Ambiente'),
('AO', 'comercial', 'Comercial', 'Infrações à legislação comercial', 'national', 'Lei do Licenciamento Comercial')
ON CONFLICT (country_code, category_code) DO NOTHING;

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_fine_institutions_country ON public.fine_institutions(country_code);
CREATE INDEX IF NOT EXISTS idx_fine_institutions_level1 ON public.fine_institutions(country_code, level1_code);
CREATE INDEX IF NOT EXISTS idx_fine_institutions_type ON public.fine_institutions(institution_type);
CREATE INDEX IF NOT EXISTS idx_violation_events_country ON public.violation_events(country_code);
CREATE INDEX IF NOT EXISTS idx_violation_events_location ON public.violation_events(country_code, level1_code, level2_code);
CREATE INDEX IF NOT EXISTS idx_fines_jurisdiction ON public.fines(country_code, jurisdiction_level1_code);