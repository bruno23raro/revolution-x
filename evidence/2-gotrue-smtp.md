# H-3 — GoTrue SMTP: FECHADO (verificado ao vivo em 2026-11-03)

## Estado
**Resolvido em 2026-10-29** via Supabase Management API (PAT do Credential Manager
`Supabase CLI:supabase`), projeto de produção `ardpabjoepzhkpmkgwgu`.

Evidência original (2026-10-29): registro em produção → **201**; e-mail
"Confirm your email" **delivered** às 19:02:15Z; usuário de teste removido depois.
Ver `artifacts/RX_INTEGRATIONS_FINAL_REPORT.md`, passo 2.

## Re-validação de hoje (2026-11-03) — leitura pura, nada alterado
`scripts/check_gotrue_smtp.ps1` → `GET /v1/projects/ardpabjoepzhkpmkgwgu/config/auth`:

- `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASS` definido (não impresso)
- `SMTP_ADMIN_EMAIL=no-reply@revolutionx.com.br`, `SMTP_SENDER_NAME=Revolution X`
- `MAILER_AUTOCONFIRM=false`, `DISABLE_SIGNUP=false`
- Subjects e templates de confirmação/recuperação presentes, usando `{{ .ConfirmationURL }}`

`scripts/check_gotrue_uris.ps1`:
- `URI_ALLOW_LIST = http://localhost:3000/auth/callback, https://revolutionx.com.br/auth/callback`

DNS do domínio de envio (DoH Cloudflare, independente do que a API diz):
- SPF `send.revolutionx.com.br`: `v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24 ~all` ✅
- DKIM `resend._domainkey.revolutionx.com.br`: chave RSA presente ✅
- DMARC `_dmarc.revolutionx.com.br`: `v=DMARC1; p=quarantine; pct=25` ✅
- SPF do apex ainda aponta para Hostinger (`include:_spf.mail.hostinger.com`) — irrelevante
  para envio Resend, que usa o subdomínio `send.`

## Os 4 fluxos pedidos
| Fluxo | Mailer | Estado |
|---|---|---|
| Cadastro (confirmação) | GoTrue (Resend) | ✅ 201 + delivered (2026-10-29) |
| Confirmação / reenvio | App → `/verify-email` (token próprio, tabela `EmailVerificationToken`, hash SHA-256) → confirma no GoTrue via `admin.updateUserById` | código + testes ✅ |
| Recuperação de senha | App → Resend (`EMAIL_PROVIDER=resend` no hPanel) | código + testes ✅ (7 testes em `src/tests/email-provider.test.ts`) |
| Redefinição | App → `/reset-password` (tabela `PasswordResetToken`) | código + testes ✅ |

Nota de arquitetura: há **dois caminhos de e-mail** no projeto, e é assim por design —
GoTrue manda os seus próprios e-mails (confirmação/reset nativos) e o app manda os dele
(por Resend, `src/lib/email.ts`). Nenhum dos dois precisa de mudança de código.

## Pendência cosmética — [HUMANO, não bloqueante]
`SITE_URL` de produção está em `http://localhost:3000`. Não quebra o cadastro, porque a
rota `register` monta o `emailRedirectTo` com `resolvePublicSiteOrigin()` (→
`https://revolutionx.com.br/auth/callback`, que está no `URI_ALLOW_LIST`). Ainda assim o
correto é: painel Supabase → Authentication → URL Configuration → **Site URL =
`https://revolutionx.com.br`**. Não alterado por decisão de preservar produção.

## Segurança
Nenhum token, senha SMTP ou link de recuperação foi impresso em log, documento ou chat.
Os scripts abaixo leem o PAT do Credential Manager em memória e não o ecoam.
