-- Auxiliar para o provisionamento de funcionários (create-staff): achar o id de
-- um utilizador pelo email (a função de servidor precisa disto quando a conta já
-- existe). SECURITY DEFINER (lê auth.users); só o service_role pode chamar.
create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql security definer set search_path = public as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.get_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;

notify pgrst, 'reload schema';
