-- Limpar instituições antigas e recriar baseadas nas 21 províncias reais
DELETE FROM fine_institutions WHERE country_code = 'AO';

-- Inserir instituições nacionais
INSERT INTO fine_institutions (code, name, country_code, institution_type, is_active)
VALUES 
  ('IGAE', 'Inspecção Geral da Administração do Estado', 'AO', 'national', true),
  ('DPNT-NACIONAL', 'Direcção Nacional do Trânsito', 'AO', 'national', true),
  ('MININT', 'Ministério do Interior', 'AO', 'national', true),
  ('MINAMB', 'Ministério do Ambiente', 'AO', 'national', true);

-- Inserir DPVT para cada uma das 21 províncias
INSERT INTO fine_institutions (code, name, country_code, level1_code, level1_name, institution_type, is_active)
SELECT 
  'DPVT-' || code,
  'DPVT ' || name,
  'AO',
  code,
  name,
  'provincial',
  true
FROM administrative_divisions 
WHERE country_code = 'AO' AND level = 1;

-- Inserir Governo Provincial para cada uma das 21 províncias
INSERT INTO fine_institutions (code, name, country_code, level1_code, level1_name, institution_type, is_active)
SELECT 
  'GP-' || code,
  'Governo Provincial - ' || name,
  'AO',
  code,
  name,
  'provincial',
  true
FROM administrative_divisions 
WHERE country_code = 'AO' AND level = 1;

-- Inserir Administrações Municipais para os 330 municípios
INSERT INTO fine_institutions (code, name, country_code, level1_code, level1_name, level2_code, level2_name, institution_type, is_active)
SELECT 
  'AM-' || m.code,
  'Administração Municipal - ' || m.name,
  'AO',
  m.parent_code,
  p.name,
  m.code,
  m.name,
  'municipal',
  true
FROM administrative_divisions m
LEFT JOIN administrative_divisions p ON p.code = m.parent_code AND p.country_code = 'AO' AND p.level = 1
WHERE m.country_code = 'AO' AND m.level = 2;