import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "@/integrations/supabase/client";

// Fix de ponto único: garante que TODAS as edge functions autenticadas recebem o
// JWT do utilizador. Sem isto, supabase.functions.invoke pode enviar a anon key
// e as funções que validam o utilizador devolvem 401 "Invalid or expired token".
// Atualiza o token da FunctionsClient a cada mudança de sessão (inicial/login/
// refresh/logout); sem sessão fica a anon key (correto para os fluxos pré-login).
supabase.auth.onAuthStateChange((_event, session) => {
  try {
    supabase.functions.setAuth(
      session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    );
  } catch {
    /* setAuth indisponível nesta versão — ignora */
  }
});

// Um deploy novo troca os hashes dos chunks; um browser com o index.html antigo
// falha ao importar um chunk que já não existe. Recarregar uma vez (com guarda
// anti-loop) obtém o build novo em vez de mostrar "Algo correu mal".
window.addEventListener("vite:preloadError", () => {
  const KEY = "afroloc-chunk-reload";
  const last = Number(sessionStorage.getItem(KEY) || "0");
  if (Date.now() - last > 10000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }
});

if ("serviceWorker" in navigator && window.self === window.top) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
