# 20 requisitos â€” SaaS seguro

| # | Requisito | Arquivo |
|---|---|---|
| 1 | HTTPS obrigatorio + HSTS | `lib/security/headers.ts` |
| 2 | CSP restritiva | idem |
| 3 | nosniff, frame-ancestors, referrer | idem |
| 4 | Rate limit por IP | `lib/security/rate-limit.ts` |
| 5 | Rate limit por e-mail | idem |
| 6 | Validacao Zod em toda borda | `lib/validation/schemas.ts` |
| 7 | Escape de saida | React + `dangerouslySetInnerHTML` so com sanitize |
| 8 | CSRF em mutacao | token + SameSite |
| 9 | Cookie httpOnly/Secure/Lax | `lib/auth/session` |
| 10 | Rotacao de sessao 7 dias | `lib/auth/session` |
| 11 | RLS em toda tabela | `prisma/migrations` |
| 12 | tenant_id em toda query | revisao + skill rls-test |
| 13 | bcrypt cost >= 12 | `lib/auth/password` |
| 14 | JWT curto + refresh rotativo | `lib/auth/token` |
| 15 | Segredo fora do codigo | `.env.local`, cofre |
| 16 | Auditoria de dependencia | CI `npm audit` + osv |
| 17 | Teste de seguranca no CI | `.github/workflows/ci.yml` |
| 18 | Log sem PII | pino redact |
| 19 | Backup + restore testado | `docs/security/backup.md` |
| 20 | Menor privilegio + RBAC | `lib/auth/rbac.ts` |
