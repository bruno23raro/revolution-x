# PROGRESSO — Sessão 2026-11-03 (protocolo autonomia + anti-400)

> Arquivo de memória de estado. Atualizar a cada etapa. Se a sessão cair,
> retomar da seção "PRÓXIMA OPERAÇÃO" — não repetir o que está em "CONCLUÍDO".

## Última atualização
2026-11-03 — commit `1981f69` (main, origin/main, CI verde)

## CONCLUÍDO (validado)
- [x] Diagnóstico do repo (git + docs + memória)
- [x] Base revalidada: jest 778/778 (56 suítes), tsc 0, lint 0 absoluto
- [x] 2 warnings lint corrigidos (FacebookPagesCard, WhatsAppQrCard)
- [x] `docs/PROJECT_HANDOFF.md` reescrito com estado real
- [x] FASE 16 (resiliência IA): inventário + `docs/project-intelligence/ROTEAMENTO-IA.md` + testes ai-* 31/31
- [x] Commit temático `bf9174e` (4 arquivos, sem segredos)
- [x] **FASE C — Publicação**: push 3 commits (1981f69), CI success, Hostinger deploy auto, smoke tests produção OK
- [x] **FASE A — IA Resilience (FreeLLMAPI local)**: OMNIROUTER_* configurado em .env.local (dev ONLY), `/v1/models` 200, `generate` gpt-oss-120b, fallback chain, rate-limit sim, auto-select — todos testados e funcionando
- [x] **FASE B — H-4 (n8n WF-04)**: webhook testado, exec #75 success, admin alert persistido, severity dinâmica do JSON body confirmada
- [x] **Multi-conta Meta por organização (H-1 técnico)**: resolvers determinísticos, seletores multicontas (UI), refresh por conta, campanhas com `accountId`, IDOR remediation, migração 016 validada em banco descartável — **70 testes PASS**
- [x] **Sanitização crítica**: BLOCKERS.md limpo (chaves n8n mascaradas) — repo público seguro

## Estado dos gateways de IA (probes 2026-11-03)
- FreeLLMAPI :3001 — UP (container saudável, `/v1/models` 200)
- OmniRoute :20128 — DOWN (nada escutando)
- Ollama :11434 — DOWN (não instalado)
- `.env.local` tem `OMNIROUTER_BASE_URL=http://127.0.0.1:3001` + `OMNIROUTER_API_KEY` + `OMNIROUTER_MODEL=auto` → cadeia local OPERACIONAL
- Produção **intocada** (usa chaves próprias no hPanel)

## Bloqueadores Humanos — Ação necessária (prioridade)

| ID | Blocker | Onde agir | Status |
|----|---------|-----------|--------|
| **H-1** | **Meta System User Token** | Meta Business Manager → app `1421814643397349` | 📋 Preparado — steps em `docs/H_BLOQUEIO.md` |
| **H-2** | **Facebook Login Review** | Meta Developer Console → app `1112157761403064` | 📋 Review submetido 2026-10-31 ("Em análise"). Código canonical: 9 scopes (`constants.ts`, consolidado 11→9 nesta sessão — removidos `pages_read_user_content` e `whatsapp_business_management` sem referência em código). Lista de remoção do Console em `docs/META_PERMISSION_AUDIT.md` |
| **H-3** | **GoTrue SMTP (produção)** | Supabase hPanel → Auth → SMTP (proj `ardpabjoepzhkpmkgwgu`) | ✅ **RESOLVIDO 2026-10-29** — SMTP ativo (resend.com:465), register 201, email delivered |
| **H-4** | **n8n WF-04 severity** | n8n workflow JSON | ✅ **RESOLVIDO 2026-11-03** — exec #75 success, alert persistido; item fechado em BLOCKERS.md |
| **H-1 técnico** | **Multi-conta Meta por organização** | Código + migração 016 | ✅ **TÉCNICAMENTE RESOLVIDO 2026-11-03** — implementação completa + 70 testes PASS. Aguarda: aplicar 016 em produção (humano). |

## H-3 — GoTrue SMTP: evidência lida ao vivo (2026-11-03)

`GET https://api.supabase.com/v1/projects/ardpabjoepzhkpmkgwgu/config/auth` (PAT do
Credential Manager `Supabase CLI:supabase`, leitura pura — nada foi alterado):

| Chave | Valor em produção |
|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` | `smtp.resend.com` / `465` / `resend` |
| `SMTP_PASS` | definido (não lido/impresso) |
| `SMTP_ADMIN_EMAIL` / `SMTP_SENDER_NAME` | `no-reply@revolutionx.com.br` / `Revolution X` |
| `MAILER_AUTOCONFIRM` | `false` (confirmação de e-mail realmente exigida) |
| `MAILER_SUBJECTS_CONFIRMATION` / `_RECOVERY` | presentes |
| `MAILER_TEMPLATES_CONFIRMATION_CONTENT` / `_RECOVERY_CONTENT` | presentes, usam `{{ .ConfirmationURL }}` |
| `URI_ALLOW_LIST` | `http://localhost:3000/auth/callback`, `https://revolutionx.com.br/auth/callback` |
| `DISABLE_SIGNUP` | `false` |

DNS do domínio de envio, conferido à parte (DoH Cloudflare): SPF `send.revolutionx.com.br`
✅, DKIM `resend._domainkey` ✅, DMARC `p=quarantine; pct=25` ✅.

⚠️ **Achado**: `SITE_URL` de produção está em `http://localhost:3000`. Não quebra o
cadastro — a rota `register` monta `emailRedirectTo` via `resolvePublicSiteOrigin`
(e-mail → `https://revolutionx.com.br/auth/callback`, que está no `URI_ALLOW_LIST`) —
mas é o padrão do GoTrue para links fora dessa allowlist. Correção (1 campo, hPanel →
Authentication → URL Configuration → Site URL = `https://revolutionx.com.br`): **[HUMANO]**,
e não é bloqueante.

## PRÓXIMA OPERAÇÃO
**Aguardando humano completar H-1 (System User Token) e H-2 (Facebook Login Review).**
H-3 (GoTrue SMTP) está **resolvido e re-confirmado ao vivo** nesta data.
**H-1 técnico (Multi-conta Meta) já está completo** — código, testes, migração 016. Apenas aguarda aplicação da 016 em produção.

Quando o humano reportar conclusão:
1. Validar H-1 (System User Token): `GET /api/admin/tasks` com sessão admin → `{count:N}`
2. Validar H-2 (Facebook Login Review): Meta Console → review submetido
3. Aplicar migração 016 no Supabase produção (desbloqueia 2ª+ conta Meta por tenant)
4. Fechar H-4 em BLOCKERS.md (já validado)

## Decisões tomadas (registradas)
- Cadeia de fallback do app não alterada (já existia, verde em testes)
- FreeLLMAPI NÃO apontado para produção (diretiva do usuário mantida)
- Produção intocada; nenhuma migration aplicada
- BLOCKERS.md sanitizado (commit 1981f69) — repo público sem segredos

## Arquivos tocados nesta sessão (últimos commits)
- docs/project-intelligence/ROTEAMENTO-IA.md (novo)
- docs/PROJECT_HANDOFF.md (reescrito)
- src/components/integrations/FacebookPagesCard.tsx (lint)
- src/components/integrations/WhatsAppQrCard.tsx (lint)
- BLOCKERS.md (sanitização segurança)