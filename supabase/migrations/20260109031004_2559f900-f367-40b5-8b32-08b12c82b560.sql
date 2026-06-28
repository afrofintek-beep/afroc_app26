-- Add severity and is_active columns to violation_codes
ALTER TABLE public.violation_codes 
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'leve',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Insert municipal violation codes
INSERT INTO public.violation_codes (code, category, description, legal_basis_ref, base_amount, currency, discount_percentage, discount_days, points, severity, is_active) VALUES
-- Limpeza e Resíduos
('MUN-001', 'municipal', 'Deposição de lixo fora dos locais designados', 'Regulamento Municipal de Limpeza Urbana', 15000, 'AOA', 25, 15, 0, 'leve', true),
('MUN-002', 'municipal', 'Deposição de entulho em via pública', 'Regulamento Municipal de Limpeza Urbana', 50000, 'AOA', 20, 15, 0, 'grave', true),
('MUN-003', 'municipal', 'Queima de lixo em área urbana', 'Regulamento Municipal Ambiental', 35000, 'AOA', 20, 15, 0, 'grave', true),
('MUN-004', 'municipal', 'Não utilização de contentores de lixo', 'Regulamento Municipal de Limpeza Urbana', 10000, 'AOA', 25, 15, 0, 'leve', true),

-- Ocupação de Espaço Público
('MUN-010', 'municipal', 'Ocupação ilegal de passeio público', 'Código de Posturas Municipais', 25000, 'AOA', 20, 15, 0, 'leve', true),
('MUN-011', 'municipal', 'Venda ambulante não licenciada', 'Regulamento de Comércio Municipal', 20000, 'AOA', 25, 15, 0, 'leve', true),
('MUN-012', 'municipal', 'Instalação de estrutura sem licença', 'Código de Posturas Municipais', 75000, 'AOA', 15, 15, 0, 'grave', true),
('MUN-013', 'municipal', 'Publicidade não autorizada em espaço público', 'Regulamento de Publicidade Municipal', 40000, 'AOA', 20, 15, 0, 'leve', true),

-- Ruído e Perturbação
('MUN-020', 'municipal', 'Perturbação sonora em horário noturno (22h-07h)', 'Regulamento Municipal de Ruído', 30000, 'AOA', 20, 15, 0, 'grave', true),
('MUN-021', 'municipal', 'Obras sem autorização em horário proibido', 'Regulamento Municipal de Ruído', 45000, 'AOA', 20, 15, 0, 'grave', true),
('MUN-022', 'municipal', 'Atividade comercial ruidosa sem licença', 'Regulamento Municipal de Ruído', 60000, 'AOA', 15, 15, 0, 'grave', true),

-- Edificações e Construções
('MUN-030', 'municipal', 'Construção sem alvará de licença', 'Código de Urbanismo', 150000, 'AOA', 10, 15, 0, 'muito_grave', true),
('MUN-031', 'municipal', 'Alteração de fachada sem autorização', 'Código de Urbanismo', 50000, 'AOA', 20, 15, 0, 'grave', true),
('MUN-032', 'municipal', 'Muro ou vedação irregular', 'Código de Posturas Municipais', 25000, 'AOA', 25, 15, 0, 'leve', true),
('MUN-033', 'municipal', 'Falta de manutenção de imóvel (perigo público)', 'Código de Posturas Municipais', 80000, 'AOA', 15, 15, 0, 'grave', true),

-- Saneamento e Águas
('MUN-040', 'municipal', 'Ligação clandestina à rede de água', 'Regulamento de Abastecimento de Água', 100000, 'AOA', 10, 15, 0, 'muito_grave', true),
('MUN-041', 'municipal', 'Descarga de águas residuais em via pública', 'Regulamento Municipal de Saneamento', 45000, 'AOA', 20, 15, 0, 'grave', true),
('MUN-042', 'municipal', 'Fossa séptica irregular', 'Regulamento Municipal de Saneamento', 60000, 'AOA', 15, 15, 0, 'grave', true),

-- Animais
('MUN-050', 'municipal', 'Animal solto em via pública', 'Regulamento Municipal de Animais', 15000, 'AOA', 25, 15, 0, 'leve', true),
('MUN-051', 'municipal', 'Criação de animais em zona urbana proibida', 'Regulamento Municipal de Animais', 35000, 'AOA', 20, 15, 0, 'grave', true),
('MUN-052', 'municipal', 'Falta de vacinação obrigatória de animal', 'Regulamento Municipal de Animais', 20000, 'AOA', 25, 15, 0, 'leve', true);

-- Add municipal institution examples
INSERT INTO public.fine_institutions (code, name, country_code, level1_code, level1_name, contact_email, is_active) VALUES
('ADM-LUA', 'Administração Municipal de Luanda', 'AO', 'LUA', 'Luanda', 'multas@adm-luanda.gov.ao', true),
('ADM-VNA', 'Administração Municipal de Viana', 'AO', 'LUA', 'Luanda', 'multas@adm-viana.gov.ao', true),
('ADM-CAZ', 'Administração Municipal de Cazenga', 'AO', 'LUA', 'Luanda', 'multas@adm-cazenga.gov.ao', true)
ON CONFLICT DO NOTHING;