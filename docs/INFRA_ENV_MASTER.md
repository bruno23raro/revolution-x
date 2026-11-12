# INFRA ENV MASTER — Revolution X
**Data:** 12/11/2026 | **Deploy Target:** HOSTINGER_ONLY

> Fonte única de verdade para todas as variáveis de ambiente.
> O deploy da Hostinger deve ter EXATAMENTE estas chaves. Nunca coloque
> credenciais reais aqui — use placeholders e injete via painel hPanel ou .env.

---

## 🔑 Obrigatórias (Sem estas o app não inicia)

| Chave | Obrigatória | Uso | Onde está |
|-------|-------------|-----|-----------|
| `NEXT_PUBLIC_APP_URL` | ✅ | URL pública (https://revolutionx.com.br) | hPanel + .env.local |
| `DATABASE_URL` | ✅ | Conexão PostgreSQL (Prisma) | hPanel + .env.local |
| `SUPABASE_URL` | ✅ | URL do Supabase projeto | hPanel + .env.local |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role (nunca no client) | hPanel (SECRET) |
| `SUPABASE_ANON_KEY` | ✅ | Anon key pública | hPanel + .env.local |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase URL pública | hPanel + .env.local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon pública | hPanel + .env.local |
| `JWT_SECRET` | ✅ | Assinatura de tokens (use generate-secret.js) | hPanel (SECRET) |

## 🔌 Integrações (Necessárias p/ WhatsApp, Instagram, Facebook)

| Chave | Obrigatória | Uso | Onde está |
|-------|-------------|-----|-----------|
| `OPENBSP_ORG_ID` | ✅ | Org OpenBSP para onboarding | hPanel (SECRET) |
| `OPENBSP_API_URL` | ✅ | URL API OpenBSP | hPanel |
| `OPENBSP_API_KEY` | ✅ | Chave API OpenBSP | hPanel (SECRET) |
| `META_APP_ID` | ✅ | App ID Meta (WhatsApp) | hPanel |
| `META_APP_SECRET` | ✅ | App Secret Meta | hPanel (SECRET) |
| `META_VERIFY_TOKEN` | ✅ | Webhook verify token | hPanel (SECRET) |
| `META_PHONE_NUMBER_ID` | ✅ | Número WhatsApp registrado | hPanel |
| `META_WABA_ID` | ✅ | WhatsApp Business Account ID | hPanel |
| `EVOLUTION_API_URL` | ✅ | Evolution API (modo manual) | hPanel |
| `EVOLUTION_API_KEY` | ✅ | Chave Evolution API | hPanel (SECRET) |
| `TIKTOK_CLIENT_KEY` | ⚠️ | Client key TikTok (se usado) | hPanel |
| `TIKTOK_CLIENT_SECRET` | ⚠️ | Client secret TikTok | hPanel (SECRET) |

## ✉️ Email & Notificação

| Chave | Obrigatória | Uso | Onde está |
|-------|-------------|-----|-----------|
| `RESEND_API_KEY` | ⚠️ | Envio de email (Resend) | hPanel (SECRET) |
| `RESEND_FROM_EMAIL` | ⚠️ | Remetente padrão | hPanel |
| `SLACK_WEBHOOK_URL` | ⚠️ | Alertas Slack (se usado) | hPanel (SECRET) |

## 📊 Observabilidade & Fila

| Chave | Obrigatória | Uso | Onde está |
|-------|-------------|-----|-----------|
| `REDIS_URL` | ⚠️ | Fila BullMQ (se usado) | hPanel |
| `REDIS_PASSWORD` | ⚠️ | Senha Redis | hPanel (SECRET) |
| `SENTRY_DSN` | ⚠️ | Sentry errors | hPanel |
| `NODE_ENV` | ✅ | `production` no hPanel | hPanel |

## 🧪 Testes (NUNCA na produção)

| Chave | Uso |
|-------|-----|
| `TEST_ADMIN_DATABASE_URL` | Banco descartável do CI |
| `TEST_RLS_DATABASE_URL` | Banco descartável do CI |
| `TEST_DATABASE_URL` | Banco descartável do CI |
| `NEXT_PUBLIC_DEMO_MODE` | `false` na produção |

---

## ⚙️ Checklist de Sincronização Hostinger

1. **Nunca** colocar chaves secretas no frontend (`NEXT_PUBLIC_` é o único prefixo permitido).
2. Variáveis com `(SECRET)` devem ficar **apenas** no painel hPanel, nunca no `.env.local` commitado.
3. `DATABASE_URL` deve usar `sslmode=require` (Hostinger recomenda `sslmode=no-verify`).
4. Após mudar env no hPanel, **reiniciar o app** (PM2 reload) p/ aplicar.

## 📦 Pipeline de Deploy (GitHub Actions → Hostinger)

Ver `docs/INFRA_DEPLOY_PIPELINE.md` para o fluxo completo.