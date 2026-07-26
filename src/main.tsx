import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// NOTA (auth): NÃO usamos mais `supabase.functions.setAuth(...)` global. Esse
// padrão dependia do timing do onAuthStateChange (race condition) e, sem sessão,
// enviava a anon key no header Authorization como se fosse o JWT do utilizador.
// Agora cada chamada PROTEGIDA usa `authedInvoke` (src/lib/authedInvoke.ts), que
// lê a sessão fresca e envia explicitamente `Authorization: Bearer <access_token>`
// — imune ao timing e nunca envia a anon key como JWT. As funções públicas/
// pré-login usam `supabase.functions.invoke` normal (apikey por omissão).

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

// O registo do service worker é feito UMA única vez pelo vite-plugin-pwa
// (registerType: "autoUpdate" + injectRegister automático). Removido o registo
// manual de "/sw.js" que colidia com o SW gerado e criava dupla estratégia.

createRoot(document.getElementById("root")!).render(<App />);
