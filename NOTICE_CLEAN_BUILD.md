# AFROLOC — Clean Source Export

Código-fonte completo da aplicação AFROLOC sem dependências, scripts ou URLs
da plataforma de desenvolvimento original.

Alterações aplicadas automaticamente:
- Removida dependência `afroloc-tagger` (package.json + vite.config.ts).
- Removido script `cdn.gpteng.co` do `index.html`.
- Reescrito `src/main.tsx` sem deteção de host de preview.
- URLs de preview/publicação substituídas por `https://app.afroloc.example`.
- `ai.gateway.afroloc.dev` substituído por `ai.gateway.example`
  (configurar o vosso próprio gateway antes de usar `AI_GATEWAY_API_KEY`).
- Removidos: `node_modules/`, `.afroloc/`, `.github/`, `bun.lockb`, `.prewarm`.

Build:
  npm install
  npm run dev
  npm run build

Backend Supabase mantém-se configurado em `src/integrations/supabase/`.
