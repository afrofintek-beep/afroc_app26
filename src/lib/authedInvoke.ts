import { supabase } from "@/integrations/supabase/client";

export interface AuthedInvokeOptions {
  method?: "POST" | "GET";
  headers?: Record<string, string>;
  /** Query string params, appended to the function URL (for GET-style functions). */
  query?: Record<string, string>;
}

export interface AuthedInvokeResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Invokes an Edge Function GUARANTEEING the user's JWT goes in the header
 * `Authorization: Bearer <access_token>`. Reads a FRESH session per call, so it is
 * immune to onAuthStateChange timing. If there is NO session, it returns a clear
 * auth error WITHOUT invoking the function (never sends the anon key as if it were
 * the user's JWT). Use for EVERY protected edge function; public/pre-login
 * functions keep using `supabase.functions.invoke` directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function authedInvoke<T = any>(
  name: string,
  body?: unknown,
  options?: AuthedInvokeOptions,
): Promise<AuthedInvokeResult<T>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return {
      data: null,
      error: new Error("AUTH_REQUIRED: sessão não encontrada. Inicie sessão novamente."),
    };
  }
  const q = options?.query ? "?" + new URLSearchParams(options.query).toString() : "";
  const res = await supabase.functions.invoke<T>(name + q, {
    method: options?.method,
    body: body as Record<string, unknown> | undefined,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(options?.headers ?? {}),
    },
  });
  return { data: (res.data as T | null) ?? null, error: (res.error as Error | null) ?? null };
}
