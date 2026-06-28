# Deploy do AFROLOC na Vercel

Guia completo para fazer o deploy desta aplicação (Vite + React + TypeScript + AFROLOC Cloud / Supabase) na **Vercel**.

---

## 1. Pré-requisitos

- Conta na [Vercel](https://vercel.com) (Hobby é suficiente para começar).
- Repositório do projeto no **GitHub / GitLab / Bitbucket**
  (na AFROLOC: botão `GitHub → Connect to GitHub` para sincronizar).
- Node.js **20.x** ou superior (a Vercel deteta automaticamente).
- Acesso ao backend AFROLOC Cloud (Supabase) já configurado neste projeto.

---

## 2. Configurações de Build

A Vercel deteta automaticamente Vite. Caso precise configurar manualmente:

| Campo | Valor |
|---|---|
| **Framework Preset** | `Vite` |
| **Build Command** | `npm run build` (ou `bun run build`) |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` (ou `bun install`) |
| **Node.js Version** | `20.x` |
| **Root Directory** | `.` (raiz do repositório) |

---

## 3. Variáveis de Ambiente

Adicione em **Project Settings → Environment Variables** (Production, Preview e Development):

```env
VITE_SUPABASE_URL=https://rxhtdejvjgopfseysuhl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aHRkZWp2amdvcGZzZXlzdWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MzMzODYsImV4cCI6MjA3ODMwOTM4Nn0.Vo_3Vn2gAITe6tf97WLMJmmch-6Ydr_iVFnLGdc_fks
VITE_SUPABASE_PROJECT_ID=rxhtdejvjgopfseysuhl
```

> Apenas variáveis com prefixo `VITE_` são expostas ao frontend. Estas três são **chaves públicas** (anon key) — seguras para o cliente.

**Segredos sensíveis** (ex. `RESEND_API_KEY`, `TWILIO_*`, `MAPBOX_TOKEN` server-side, `VAPID_PRIVATE_KEY`) **NÃO** devem ser colocados na Vercel — vivem nas Edge Functions do AFROLOC Cloud (Supabase), já configurados.

---

## 4. Routing SPA (importante)

Como é uma SPA com React Router, crie um ficheiro `vercel.json` na raiz para que recargas em rotas como `/my-addresses` não devolvam 404:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

---

## 5. Passos de Deploy

### Via Dashboard (recomendado)
1. Vercel → **Add New → Project**.
2. Importe o repositório GitHub do AFROLOC.
3. Confirme **Framework Preset: Vite**, Build `npm run build`, Output `dist`.
4. Cole as **3 variáveis `VITE_*`** acima (Production + Preview + Development).
5. **Deploy** — o primeiro build leva 2–4 min.
6. Aceda ao URL `https://<seu-projeto>.vercel.app`.

### Via CLI
```bash
npm i -g vercel
vercel login
vercel link            # liga este diretório a um projeto Vercel
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY
vercel env add VITE_SUPABASE_PROJECT_ID
vercel --prod          # deploy para produção
```

---

## 6. Domínio Personalizado

1. Vercel → Project → **Settings → Domains → Add**.
2. Adicione `app.seu-dominio.com`.
3. Configure no seu DNS:
   - **CNAME** `app` → `cname.vercel-dns.com`
   - ou **A** `@` → `76.76.21.21` para apex.
4. SSL (Let's Encrypt) é provisionado automaticamente.

---

## 7. Configuração Backend (AFROLOC Cloud / Supabase)

Após o deploy, adicione o URL de produção da Vercel às origens permitidas:

- **Auth → URL Configuration → Site URL**: `https://app.seu-dominio.com`
- **Redirect URLs**: adicione `https://app.seu-dominio.com/**` e o `*.vercel.app` para previews.
- **CSP** (já configurada no `index.html`) — verifique que cobre o novo domínio se for adicionar serviços externos.

Para **Google OAuth**:
- Atualize **Authorized JavaScript origins** e **Redirect URIs** na Google Cloud Console com o novo domínio.

---

## 8. Verificações Pós-Deploy

- [ ] Login com email/password funciona.
- [ ] Login Google redireciona corretamente.
- [ ] Mapas Mapbox carregam (verificar CSP e referer restrictions).
- [ ] PWA instalável (manifest + `pwa-512x512.png` servidos).
- [ ] Service Worker (`/sw.js`) regista em produção mas **não** em preview AFROLOC.
- [ ] Edge Functions respondem (testar `/v1/sync/places`, `address-gateway`).
- [ ] Deep links `/dl/:code` resolvem.

---

## 9. Pipeline Contínuo

A Vercel cria automaticamente:
- **Production** a cada push em `main`.
- **Preview deployments** para cada PR.
- O workflow `.github/workflows/no-multago.yml` corre em paralelo e bloqueia merges que reintroduzam referências removidas.

---

## 10. Troubleshooting

| Problema | Solução |
|---|---|
| `404` ao recarregar rota | Verifique `vercel.json` com `rewrites`. |
| Variáveis `undefined` no cliente | Devem ter prefixo `VITE_` e estar definidas para o ambiente correto (Prod/Preview). |
| Build falha em `validate-translations` | Já desativado em `vite.config.ts`. Correr manualmente: `node scripts/validate-translations.js`. |
| Bundle > 5 MB | Já há `manualChunks` (mapbox, react-vendor, ui-vendor) — considere lazy-loading adicional. |
| Service Worker em loop | A guarda em `src/main.tsx` impede registo em iframes/preview — confirmar domínio final. |
| Auth com `redirect_uri_mismatch` | Adicionar URL Vercel em Supabase Auth → Redirect URLs e Google Console. |

---

**Pronto.** Após o primeiro deploy bem-sucedido, qualquer commit em `main` republica automaticamente.
