import { supabase } from "@/integrations/supabase/client";
import type { FunctionsResponse } from "@supabase/supabase-js";

/**
 * Invoca uma edge function garantindo que o JWT do utilizador vai no header
 * Authorization. O `supabase.functions.invoke` pode enviar a anon key em vez do
 * access_token da sessão, fazendo as funções que validam o utilizador (getUser)
 * devolverem 401 "Invalid or expired token" (frontend mostra "Edge Function
 * returned a non-2xx status code"). Usar isto para qualquer função autenticada.
 */
export async function authedInvoke<T = unknown>(
  name: string,
  body?: unknown,
): Promise<FunctionsResponse<T>> {
  const { data: { session } } = await supabase.auth.getSession();
  return supabase.functions.invoke<T>(name, {
    body: body as Record<string, unknown> | undefined,
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined,
  });
}
