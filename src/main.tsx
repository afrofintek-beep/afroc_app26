import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
