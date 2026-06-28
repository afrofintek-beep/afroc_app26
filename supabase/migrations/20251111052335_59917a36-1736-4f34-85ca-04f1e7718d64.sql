-- Insert telecom operators for all 54 African countries
-- Note: Prefixes are based on common patterns, may need verification for some operators

-- Algeria
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('DZ', 'Mobilis', 'MOBILIS', ARRAY['55', '56', '57', '58', '59'], 'twilio', true),
  ('DZ', 'Djezzy', 'DJEZZY', ARRAY['77', '78', '79'], 'twilio', true),
  ('DZ', 'Ooredoo', 'OOREDOO', ARRAY['54', '55', '66', '67', '68', '69'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Angola (already added, but including for completeness)
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('AO', 'Unitel', 'UNITEL', ARRAY['923', '924', '926', '927'], 'twilio', true),
  ('AO', 'Movicel', 'MOVICEL', ARRAY['921', '922', '925'], 'twilio', true),
  ('AO', 'Africell', 'AFRICELL', ARRAY['928', '929'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Benin
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('BJ', 'MTN Benin', 'MTN', ARRAY['96', '97', '66', '67'], 'twilio', true),
  ('BJ', 'Moov', 'MOOV', ARRAY['61', '62', '63', '64', '65'], 'twilio', true),
  ('BJ', 'Glo', 'GLO', ARRAY['98', '99'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Botswana
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('BW', 'Mascom', 'MASCOM', ARRAY['71', '72', '73', '74', '75'], 'twilio', true),
  ('BW', 'Orange', 'ORANGE', ARRAY['76', '77', '78'], 'twilio', true),
  ('BW', 'BTC Mobile', 'BTC', ARRAY['26', '27'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Burkina Faso
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('BF', 'Orange', 'ORANGE', ARRAY['01', '02', '03'], 'twilio', true),
  ('BF', 'Telecel Faso', 'TELECEL', ARRAY['70', '71', '72', '73'], 'twilio', true),
  ('BF', 'Moov', 'MOOV', ARRAY['60', '61', '62', '63'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Burundi
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('BI', 'Econet', 'ECONET', ARRAY['69', '71', '72', '73'], 'twilio', true),
  ('BI', 'Onatel', 'ONATEL', ARRAY['74', '75', '76', '77'], 'twilio', true),
  ('BI', 'Smart', 'SMART', ARRAY['78', '79'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Cameroon
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('CM', 'MTN', 'MTN', ARRAY['67', '650', '651', '652', '653', '654'], 'twilio', true),
  ('CM', 'Orange', 'ORANGE', ARRAY['69', '655', '656', '657', '658', '659'], 'twilio', true),
  ('CM', 'Nexttel', 'NEXTTEL', ARRAY['66'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Cape Verde
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('CV', 'CVMovel', 'CVMOVEL', ARRAY['99', '98'], 'twilio', true),
  ('CV', 'Unitel T+', 'UNITEL', ARRAY['95', '96', '97'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Central African Republic
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('CF', 'Orange', 'ORANGE', ARRAY['70', '71', '72', '73'], 'twilio', true),
  ('CF', 'Telecel', 'TELECEL', ARRAY['75', '76', '77'], 'twilio', true),
  ('CF', 'Azur', 'AZUR', ARRAY['74'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Chad
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('TD', 'Airtel', 'AIRTEL', ARRAY['62', '66', '67', '68', '69'], 'twilio', true),
  ('TD', 'Tigo', 'TIGO', ARRAY['63', '64', '77', '78', '79'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Comoros
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('KM', 'Telma', 'TELMA', ARRAY['32', '33', '34'], 'twilio', true),
  ('KM', 'Comores Telecom', 'COMTEL', ARRAY['35', '36', '37', '38'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Congo (Brazzaville)
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('CG', 'MTN', 'MTN', ARRAY['04', '05', '06'], 'twilio', true),
  ('CG', 'Airtel', 'AIRTEL', ARRAY['01', '02', '03'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- DR Congo
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('CD', 'Vodacom', 'VODACOM', ARRAY['81', '82', '83', '84', '85'], 'twilio', true),
  ('CD', 'Airtel', 'AIRTEL', ARRAY['97', '99'], 'twilio', true),
  ('CD', 'Orange', 'ORANGE', ARRAY['89', '80'], 'twilio', true),
  ('CD', 'Africell', 'AFRICELL', ARRAY['90', '91'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Djibouti
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('DJ', 'Djibouti Telecom', 'DJTEL', ARRAY['77'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Egypt
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('EG', 'Orange', 'ORANGE', ARRAY['10', '11', '12'], 'twilio', true),
  ('EG', 'Vodafone', 'VODAFONE', ARRAY['10', '11', '12'], 'twilio', true),
  ('EG', 'Etisalat', 'ETISALAT', ARRAY['11', '14', '15'], 'twilio', true),
  ('EG', 'WE', 'WE', ARRAY['15'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Equatorial Guinea
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('GQ', 'Orange', 'ORANGE', ARRAY['22', '55'], 'twilio', true),
  ('GQ', 'Getesa', 'GETESA', ARRAY['333', '555'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Eritrea
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('ER', 'Eritel', 'ERITEL', ARRAY['7', '8'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Eswatini (Swaziland)
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('SZ', 'MTN', 'MTN', ARRAY['76', '78'], 'twilio', true),
  ('SZ', 'Swazi Mobile', 'SWAZI', ARRAY['77', '79'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Ethiopia
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('ET', 'Ethio Telecom', 'ETHIOTEL', ARRAY['91', '92', '93', '94'], 'twilio', true),
  ('ET', 'Safaricom', 'SAFARICOM', ARRAY['90'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Gabon
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('GA', 'Airtel', 'AIRTEL', ARRAY['06', '07'], 'twilio', true),
  ('GA', 'Moov', 'MOOV', ARRAY['02', '03', '04', '05'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Gambia
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('GM', 'Africell', 'AFRICELL', ARRAY['77', '79'], 'twilio', true),
  ('GM', 'Gamcel', 'GAMCEL', ARRAY['77', '99'], 'twilio', true),
  ('GM', 'Qcell', 'QCELL', ARRAY['30', '33'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Ghana
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('GH', 'MTN', 'MTN', ARRAY['24', '54', '55', '59'], 'twilio', true),
  ('GH', 'Vodafone', 'VODAFONE', ARRAY['20', '50'], 'twilio', true),
  ('GH', 'AirtelTigo', 'AIRTELTIGO', ARRAY['26', '27', '56', '57'], 'twilio', true),
  ('GH', 'Glo', 'GLO', ARRAY['23'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Guinea
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('GN', 'MTN', 'MTN', ARRAY['62', '66', '67'], 'twilio', true),
  ('GN', 'Orange', 'ORANGE', ARRAY['60', '61', '64', '65'], 'twilio', true),
  ('GN', 'Cellcom', 'CELLCOM', ARRAY['63', '69'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Guinea-Bissau
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('GW', 'MTN', 'MTN', ARRAY['96', '97'], 'twilio', true),
  ('GW', 'Orange', 'ORANGE', ARRAY['95', '96'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Ivory Coast
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('CI', 'MTN', 'MTN', ARRAY['05', '06', '07', '46', '47', '48', '49', '56', '57'], 'twilio', true),
  ('CI', 'Orange', 'ORANGE', ARRAY['01', '02', '03', '07', '08', '09', '40', '41', '42', '43', '44', '45'], 'twilio', true),
  ('CI', 'Moov', 'MOOV', ARRAY['01', '02', '03', '50', '51', '52', '53'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Kenya
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('KE', 'Safaricom', 'SAFARICOM', ARRAY['70', '71', '72', '74', '79', '110', '111', '112', '113', '114', '115'], 'twilio', true),
  ('KE', 'Airtel', 'AIRTEL', ARRAY['73', '78', '100', '101', '102'], 'twilio', true),
  ('KE', 'Telkom', 'TELKOM', ARRAY['77'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Lesotho
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('LS', 'Vodacom', 'VODACOM', ARRAY['50', '51', '52', '56', '57', '58', '59'], 'twilio', true),
  ('LS', 'Econet Telecom', 'ECONET', ARRAY['62', '66', '67', '68'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Liberia
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('LR', 'MTN', 'MTN', ARRAY['77', '88'], 'twilio', true),
  ('LR', 'Orange', 'ORANGE', ARRAY['88'], 'twilio', true),
  ('LR', 'Lonestar', 'LONESTAR', ARRAY['77', '88'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Libya
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('LY', 'Libyana', 'LIBYANA', ARRAY['91', '92'], 'twilio', true),
  ('LY', 'Al-Madar', 'ALMADAR', ARRAY['94', '95'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Madagascar
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('MG', 'Telma', 'TELMA', ARRAY['32', '33', '34'], 'twilio', true),
  ('MG', 'Orange', 'ORANGE', ARRAY['32', '33', '34', '38'], 'twilio', true),
  ('MG', 'Airtel', 'AIRTEL', ARRAY['32', '33'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Malawi
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('MW', 'TNM', 'TNM', ARRAY['88', '99'], 'twilio', true),
  ('MW', 'Airtel', 'AIRTEL', ARRAY['88', '99'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Mali
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('ML', 'Orange', 'ORANGE', ARRAY['70', '71', '72', '73', '74', '75', '76', '77', '78', '79'], 'twilio', true),
  ('ML', 'Malitel', 'MALITEL', ARRAY['66', '67', '68', '69'], 'twilio', true),
  ('ML', 'Moov', 'MOOV', ARRAY['90', '91', '92', '93', '94', '95', '96', '97', '98', '99'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Mauritania
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('MR', 'Mattel', 'MATTEL', ARRAY['22', '32', '33', '44'], 'twilio', true),
  ('MR', 'Mauritel', 'MAURITEL', ARRAY['46', '47', '48', '49'], 'twilio', true),
  ('MR', 'Chinguitel', 'CHINGUITEL', ARRAY['31', '37'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Mauritius
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('MU', 'Emtel', 'EMTEL', ARRAY['52', '54', '59'], 'twilio', true),
  ('MU', 'MTML', 'MTML', ARRAY['57', '58'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Morocco
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('MA', 'Maroc Telecom', 'IAM', ARRAY['6', '7'], 'twilio', true),
  ('MA', 'Orange', 'ORANGE', ARRAY['6', '7'], 'twilio', true),
  ('MA', 'Inwi', 'INWI', ARRAY['6', '7'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Mozambique
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('MZ', 'Vodacom', 'VODACOM', ARRAY['84', '85'], 'twilio', true),
  ('MZ', 'Movitel', 'MOVITEL', ARRAY['86', '87'], 'twilio', true),
  ('MZ', 'TMcel', 'TMCEL', ARRAY['82', '83'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Namibia
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('NA', 'MTC', 'MTC', ARRAY['81'], 'twilio', true),
  ('NA', 'TN Mobile', 'TNMOBILE', ARRAY['85'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Niger
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('NE', 'Airtel', 'AIRTEL', ARRAY['96', '97'], 'twilio', true),
  ('NE', 'Orange', 'ORANGE', ARRAY['93', '94', '95'], 'twilio', true),
  ('NE', 'Moov', 'MOOV', ARRAY['90', '91', '92'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Nigeria
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('NG', 'MTN', 'MTN', ARRAY['803', '806', '810', '813', '814', '816', '903', '906'], 'twilio', true),
  ('NG', 'Glo', 'GLO', ARRAY['805', '807', '811', '815', '905'], 'twilio', true),
  ('NG', 'Airtel', 'AIRTEL', ARRAY['802', '808', '812', '901', '902', '904', '907'], 'twilio', true),
  ('NG', '9mobile', '9MOBILE', ARRAY['809', '817', '818', '909'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Rwanda
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('RW', 'MTN', 'MTN', ARRAY['78'], 'twilio', true),
  ('RW', 'Airtel', 'AIRTEL', ARRAY['73'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Sao Tome and Principe
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('ST', 'CST', 'CST', ARRAY['98', '99'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Senegal
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('SN', 'Orange', 'ORANGE', ARRAY['77', '78'], 'twilio', true),
  ('SN', 'Free', 'FREE', ARRAY['76'], 'twilio', true),
  ('SN', 'Expresso', 'EXPRESSO', ARRAY['70'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Seychelles
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('SC', 'Airtel', 'AIRTEL', ARRAY['51', '52', '53'], 'twilio', true),
  ('SC', 'Cable & Wireless', 'CW', ARRAY['24', '25', '26', '27', '28', '29'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Sierra Leone
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('SL', 'Orange', 'ORANGE', ARRAY['30', '33', '76', '77', '78'], 'twilio', true),
  ('SL', 'Africell', 'AFRICELL', ARRAY['76', '79', '88'], 'twilio', true),
  ('SL', 'Qcell', 'QCELL', ARRAY['34'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Somalia
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('SO', 'Hormuud', 'HORMUUD', ARRAY['61', '62', '90', '91'], 'twilio', true),
  ('SO', 'Golis', 'GOLIS', ARRAY['90', '91'], 'twilio', true),
  ('SO', 'Somtel', 'SOMTEL', ARRAY['63', '65'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- South Africa
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('ZA', 'Vodacom', 'VODACOM', ARRAY['60', '71', '72', '73', '74', '79', '82', '83'], 'twilio', true),
  ('ZA', 'MTN', 'MTN', ARRAY['60', '61', '63', '64', '65', '66', '67', '68', '69', '76', '81', '83'], 'twilio', true),
  ('ZA', 'Cell C', 'CELLC', ARRAY['60', '61', '62', '74', '84'], 'twilio', true),
  ('ZA', 'Telkom Mobile', 'TELKOM', ARRAY['60', '81'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- South Sudan
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('SS', 'MTN', 'MTN', ARRAY['12', '18'], 'twilio', true),
  ('SS', 'Zain', 'ZAIN', ARRAY['11', '15', '16', '17'], 'twilio', true),
  ('SS', 'Gemtel', 'GEMTEL', ARRAY['77', '88'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Sudan
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('SD', 'Zain', 'ZAIN', ARRAY['91', '12'], 'twilio', true),
  ('SD', 'MTN', 'MTN', ARRAY['92', '18'], 'twilio', true),
  ('SD', 'Sudani', 'SUDANI', ARRAY['99', '11', '19'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Tanzania
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('TZ', 'Vodacom', 'VODACOM', ARRAY['74', '75', '76'], 'twilio', true),
  ('TZ', 'Airtel', 'AIRTEL', ARRAY['78', '68', '69'], 'twilio', true),
  ('TZ', 'Tigo', 'TIGO', ARRAY['71', '72', '73', '77', '65', '67'], 'twilio', true),
  ('TZ', 'Halotel', 'HALOTEL', ARRAY['62', '61'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Togo
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('TG', 'Moov', 'MOOV', ARRAY['90', '91', '92', '93'], 'twilio', true),
  ('TG', 'Togocom', 'TOGOCOM', ARRAY['70', '79', '99'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Tunisia
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('TN', 'Ooredoo', 'OOREDOO', ARRAY['2', '4', '5', '9'], 'twilio', true),
  ('TN', 'Orange', 'ORANGE', ARRAY['2', '4', '5', '9'], 'twilio', true),
  ('TN', 'Tunisie Telecom', 'TTELECOM', ARRAY['2', '4', '5', '9'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Uganda
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('UG', 'MTN', 'MTN', ARRAY['77', '78'], 'twilio', true),
  ('UG', 'Airtel', 'AIRTEL', ARRAY['70', '75'], 'twilio', true),
  ('UG', 'Africell', 'AFRICELL', ARRAY['79'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Zambia
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('ZM', 'MTN', 'MTN', ARRAY['96', '76', '77'], 'twilio', true),
  ('ZM', 'Airtel', 'AIRTEL', ARRAY['97', '95', '77'], 'twilio', true),
  ('ZM', 'Zamtel', 'ZAMTEL', ARRAY['95'], 'twilio', true)
ON CONFLICT DO NOTHING;

-- Zimbabwe
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('ZW', 'Econet', 'ECONET', ARRAY['77', '78'], 'twilio', true),
  ('ZW', 'NetOne', 'NETONE', ARRAY['71'], 'twilio', true),
  ('ZW', 'Telecel', 'TELECEL', ARRAY['73'], 'twilio', true)
ON CONFLICT DO NOTHING;