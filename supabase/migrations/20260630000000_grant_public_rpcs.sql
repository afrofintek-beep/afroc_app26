-- Permitir que utilizadores NÃO autenticados (role anon) executem as funções
-- usadas ANTES do login (validação do número / deteção de operadora no
-- registo e login por telemóvel). Sem isto: "permission denied for function".
GRANT EXECUTE ON FUNCTION public.get_telecom_operator_by_phone(text) TO anon, authenticated;
