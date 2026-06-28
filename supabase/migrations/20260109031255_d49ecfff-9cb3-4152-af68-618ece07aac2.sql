-- =============================================
-- INFRAÇÕES DE TRANSPORTE PÚBLICO
-- =============================================
INSERT INTO public.violation_codes (code, category, description, legal_basis_ref, base_amount, currency, discount_percentage, discount_days, points, severity, is_active) VALUES
('TRANSP-001', 'transporte', 'Operação de transporte público sem licença', 'Lei dos Transportes Rodoviários', 200000, 'AOA', 10, 15, 0, 'muito_grave', true),
('TRANSP-002', 'transporte', 'Excesso de lotação em veículo de passageiros', 'Lei dos Transportes Rodoviários', 75000, 'AOA', 20, 15, 0, 'grave', true),
('TRANSP-003', 'transporte', 'Cobrança de tarifa acima do autorizado', 'Regulamento de Tarifas de Transporte', 50000, 'AOA', 20, 15, 0, 'grave', true),
('TRANSP-004', 'transporte', 'Recusa de transporte sem justificação', 'Lei dos Transportes Rodoviários', 25000, 'AOA', 25, 15, 0, 'leve', true),
('TRANSP-005', 'transporte', 'Veículo sem condições de segurança', 'Lei dos Transportes Rodoviários', 100000, 'AOA', 15, 15, 0, 'muito_grave', true),
('TRANSP-006', 'transporte', 'Motorista sem formação obrigatória', 'Regulamento de Transporte de Passageiros', 60000, 'AOA', 20, 15, 0, 'grave', true),
('TRANSP-007', 'transporte', 'Incumprimento de rota autorizada', 'Lei dos Transportes Rodoviários', 35000, 'AOA', 25, 15, 0, 'leve', true),
('TRANSP-008', 'transporte', 'Transporte de mercadorias perigosas sem autorização', 'Regulamento de Mercadorias Perigosas', 150000, 'AOA', 10, 15, 0, 'muito_grave', true),
('TRANSP-009', 'transporte', 'Falta de seguro obrigatório de passageiros', 'Lei de Seguros de Transporte', 80000, 'AOA', 15, 15, 0, 'grave', true),
('TRANSP-010', 'transporte', 'Condutor sem descanso obrigatório', 'Regulamento de Condução Profissional', 45000, 'AOA', 20, 15, 0, 'grave', true),

-- =============================================
-- INFRAÇÕES AMBIENTAIS
-- =============================================
('AMB-001', 'ambiental', 'Poluição de curso de água', 'Lei de Bases do Ambiente', 250000, 'AOA', 10, 15, 0, 'muito_grave', true),
('AMB-002', 'ambiental', 'Emissão de poluentes acima do limite', 'Regulamento de Qualidade do Ar', 150000, 'AOA', 15, 15, 0, 'muito_grave', true),
('AMB-003', 'ambiental', 'Descarte ilegal de resíduos industriais', 'Lei de Gestão de Resíduos', 200000, 'AOA', 10, 15, 0, 'muito_grave', true),
('AMB-004', 'ambiental', 'Desmatamento sem autorização', 'Lei Florestal', 300000, 'AOA', 5, 15, 0, 'muito_grave', true),
('AMB-005', 'ambiental', 'Caça ou pesca ilegal', 'Lei de Conservação da Natureza', 100000, 'AOA', 15, 15, 0, 'grave', true),
('AMB-006', 'ambiental', 'Extração de areia sem licença', 'Lei de Recursos Minerais', 150000, 'AOA', 10, 15, 0, 'muito_grave', true),
('AMB-007', 'ambiental', 'Queimada não controlada', 'Lei de Bases do Ambiente', 80000, 'AOA', 15, 15, 0, 'grave', true),
('AMB-008', 'ambiental', 'Actividade sem licença ambiental', 'Lei de Avaliação de Impacto Ambiental', 200000, 'AOA', 10, 15, 0, 'muito_grave', true),
('AMB-009', 'ambiental', 'Ruído industrial acima do permitido', 'Regulamento de Ruído Ambiental', 60000, 'AOA', 20, 15, 0, 'grave', true),
('AMB-010', 'ambiental', 'Falta de tratamento de efluentes', 'Lei de Águas', 120000, 'AOA', 15, 15, 0, 'grave', true),

-- =============================================
-- INFRAÇÕES COMERCIAIS
-- =============================================
('COM-001', 'comercial', 'Actividade comercial sem alvará', 'Lei do Licenciamento Comercial', 100000, 'AOA', 15, 15, 0, 'grave', true),
('COM-002', 'comercial', 'Venda de produtos fora do prazo de validade', 'Regulamento de Segurança Alimentar', 150000, 'AOA', 10, 15, 0, 'muito_grave', true),
('COM-003', 'comercial', 'Preços não afixados', 'Lei de Defesa do Consumidor', 25000, 'AOA', 25, 15, 0, 'leve', true),
('COM-004', 'comercial', 'Publicidade enganosa', 'Lei de Defesa do Consumidor', 75000, 'AOA', 20, 15, 0, 'grave', true),
('COM-005', 'comercial', 'Venda de produtos contrafeitos', 'Lei de Propriedade Industrial', 200000, 'AOA', 10, 15, 0, 'muito_grave', true),
('COM-006', 'comercial', 'Recusa de emissão de factura', 'Código Geral Tributário', 50000, 'AOA', 20, 15, 0, 'grave', true),
('COM-007', 'comercial', 'Falta de livro de reclamações', 'Lei de Defesa do Consumidor', 30000, 'AOA', 25, 15, 0, 'leve', true),
('COM-008', 'comercial', 'Condições de higiene inadequadas', 'Regulamento de Higiene Comercial', 80000, 'AOA', 15, 15, 0, 'grave', true),
('COM-009', 'comercial', 'Horário de funcionamento irregular', 'Regulamento de Actividade Comercial', 20000, 'AOA', 25, 15, 0, 'leve', true),
('COM-010', 'comercial', 'Armazenamento irregular de produtos', 'Regulamento de Segurança Alimentar', 60000, 'AOA', 20, 15, 0, 'grave', true),

-- =============================================
-- MAIS INFRAÇÕES DE TRÂNSITO
-- =============================================
('TRANS011', 'transito', 'Documentos do veículo inválidos', 'Código de Estrada Art. 120', 40000, 'AOA', 20, 15, 3, 'grave', true),
('TRANS012', 'transito', 'Falta de inspecção periódica', 'Código de Estrada Art. 119', 35000, 'AOA', 20, 15, 2, 'leve', true),
('TRANS013', 'transito', 'Luzes obrigatórias avariadas', 'Código de Estrada Art. 60', 20000, 'AOA', 25, 15, 2, 'leve', true),
('TRANS014', 'transito', 'Pneus em mau estado', 'Código de Estrada Art. 62', 25000, 'AOA', 25, 15, 2, 'leve', true),
('TRANS015', 'transito', 'Fuga após acidente', 'Código de Estrada Art. 89', 200000, 'AOA', 0, 0, 6, 'muito_grave', true),
('TRANS016', 'transito', 'Circulação em sentido proibido', 'Código de Estrada Art. 29', 50000, 'AOA', 20, 15, 4, 'grave', true),
('TRANS017', 'transito', 'Manobra perigosa', 'Código de Estrada Art. 34', 45000, 'AOA', 20, 15, 4, 'grave', true),
('TRANS018', 'transito', 'Desrespeito à passadeira', 'Código de Estrada Art. 32', 40000, 'AOA', 20, 15, 3, 'grave', true),
('TRANS019', 'transito', 'Vidros escurecidos sem autorização', 'Código de Estrada Art. 63', 30000, 'AOA', 25, 15, 2, 'leve', true),
('TRANS020', 'transito', 'Transporte irregular de crianças', 'Código de Estrada Art. 55', 35000, 'AOA', 20, 15, 3, 'grave', true);

-- =============================================
-- INSTITUIÇÕES ADICIONAIS DE ANGOLA
-- =============================================
INSERT INTO public.fine_institutions (code, name, country_code, level1_code, level1_name, contact_email, is_active) VALUES
-- Direcções Provinciais de Viação e Trânsito
('DPVT-CBN', 'Direcção Provincial de Viação e Trânsito de Cabinda', 'AO', 'CBN', 'Cabinda', NULL, true),
('DPVT-ZAI', 'Direcção Provincial de Viação e Trânsito do Zaire', 'AO', 'ZAI', 'Zaire', NULL, true),
('DPVT-UIG', 'Direcção Provincial de Viação e Trânsito do Uíge', 'AO', 'UIG', 'Uíge', NULL, true),
('DPVT-LNO', 'Direcção Provincial de Viação e Trânsito da Lunda Norte', 'AO', 'LNO', 'Lunda Norte', NULL, true),
('DPVT-LSU', 'Direcção Provincial de Viação e Trânsito da Lunda Sul', 'AO', 'LSU', 'Lunda Sul', NULL, true),
('DPVT-MAL', 'Direcção Provincial de Viação e Trânsito de Malanje', 'AO', 'MAL', 'Malanje', NULL, true),
('DPVT-KNO', 'Direcção Provincial de Viação e Trânsito do Cuanza Norte', 'AO', 'KNO', 'Cuanza Norte', NULL, true),
('DPVT-KSU', 'Direcção Provincial de Viação e Trânsito do Cuanza Sul', 'AO', 'KSU', 'Cuanza Sul', NULL, true),
('DPVT-NAM', 'Direcção Provincial de Viação e Trânsito do Namibe', 'AO', 'NAM', 'Namibe', NULL, true),
('DPVT-CUN', 'Direcção Provincial de Viação e Trânsito do Cunene', 'AO', 'CUN', 'Cunene', NULL, true),
('DPVT-HUA', 'Direcção Provincial de Viação e Trânsito do Huambo', 'AO', 'HUA', 'Huambo', NULL, true),
('DPVT-BIE', 'Direcção Provincial de Viação e Trânsito do Bié', 'AO', 'BIE', 'Bié', NULL, true),
('DPVT-MOX', 'Direcção Provincial de Viação e Trânsito do Moxico', 'AO', 'MOX', 'Moxico', NULL, true),
('DPVT-KBO', 'Direcção Provincial de Viação e Trânsito do Cuando Cubango', 'AO', 'KBO', 'Cuando Cubango', NULL, true),
-- Inspecção Geral
('IGAE', 'Inspecção Geral das Actividades Económicas', 'AO', NULL, NULL, 'geral@igae.gov.ao', true),
('IGA', 'Inspecção Geral do Ambiente', 'AO', NULL, NULL, 'geral@iga.gov.ao', true),
('IGT', 'Inspecção Geral dos Transportes', 'AO', NULL, NULL, 'geral@igt.gov.ao', true),
-- Autoridades Municipais de outras províncias
('ADM-HUA', 'Administração Municipal do Huambo', 'AO', 'HUA', 'Huambo', NULL, true),
('ADM-BGU', 'Administração Municipal de Benguela', 'AO', 'BGU', 'Benguela', NULL, true),
('ADM-LBT', 'Administração Municipal de Lobito', 'AO', 'BGU', 'Benguela', NULL, true),
('ADM-CBN', 'Administração Municipal de Cabinda', 'AO', 'CBN', 'Cabinda', NULL, true),
('ADM-LBG', 'Administração Municipal de Lubango', 'AO', 'HUI', 'Huíla', NULL, true)
ON CONFLICT DO NOTHING;