import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ---- base64url <-> ArrayBuffer ----------------------------------------------
function b64urlToBuf(s: string): ArrayBuffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// supabase.functions.invoke devolve o erro real no corpo (error.context = Response).
async function invokeError(error: unknown): Promise<string> {
  try {
    const ctx = (error as { context?: Response })?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    }
  } catch {
    /* ignore */
  }
  return (error as { message?: string })?.message || "Erro desconhecido";
}

export interface PasskeyRow {
  id: string;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
}

export function useWebAuthn() {
  const [isSupported, setIsSupported] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const ok =
          typeof window !== "undefined" &&
          !!window.PublicKeyCredential &&
          (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
        setIsSupported(!!ok);
      } catch {
        setIsSupported(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    // Cast: a tabela webauthn_credentials ainda não está em types.ts (regenerar
    // após correr a migração). A RLS restringe às credenciais do próprio.
    const { data } = await (supabase as any)
      .from("webauthn_credentials")
      .select("id, device_name, created_at, last_used_at")
      .order("created_at", { ascending: false });
    setPasskeys((data as PasskeyRow[]) ?? []);
  }, []);

  useEffect(() => {
    if (isSupported) refresh();
  }, [isSupported, refresh]);

  /** Regista um novo passkey (Face ID / Touch ID / impressão) na conta ativa. */
  const register = useCallback(async (deviceName?: string) => {
    setBusy(true);
    try {
      // 1) Opções + challenge do servidor.
      const { data: options, error: optErr } = await supabase.functions.invoke(
        "webauthn-register-options",
        { body: {} },
      );
      if (optErr) throw new Error(await invokeError(optErr));

      // 2) Converter base64url -> ArrayBuffer para a WebAuthn API.
      const publicKey: PublicKeyCredentialCreationOptions = {
        ...options,
        challenge: b64urlToBuf(options.challenge),
        user: { ...options.user, id: b64urlToBuf(options.user.id) },
        excludeCredentials: (options.excludeCredentials ?? []).map(
          (c: { id: string; type: string; transports?: string[] }) => ({
            ...c,
            id: b64urlToBuf(c.id),
          }),
        ),
      };

      const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
      if (!cred) throw new Error("Registo cancelado");

      const att = cred.response as AuthenticatorAttestationResponse;
      const credential = {
        id: cred.id,
        rawId: bufToB64url(cred.rawId),
        type: cred.type,
        response: {
          attestationObject: bufToB64url(att.attestationObject),
          clientDataJSON: bufToB64url(att.clientDataJSON),
          transports:
            typeof att.getTransports === "function" ? att.getTransports() : [],
        },
        clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
      };

      // 3) Verificar e guardar no servidor.
      const { data: result, error: vErr } = await supabase.functions.invoke(
        "webauthn-register-verify",
        { body: { credential, device_name: deviceName } },
      );
      if (vErr) throw new Error(await invokeError(vErr));

      await refresh();
      return result;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  /** Remove um passkey (RLS permite ao próprio utilizador). */
  const removePasskey = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from("webauthn_credentials").delete().eq("id", id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  return { isSupported, checking, busy, passkeys, register, removePasskey, refresh };
}
