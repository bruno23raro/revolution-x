# AGENTS.md

## Rodar
`npm install` → `npx prisma generate` → `npm run dev` (porta 4800).
Produção: `npx vercel --prod --yes --force` em `fix/openbsp-test`.

## Qualidade (obrigatório antes de commit)
`npx tsc --noEmit` → `npx next lint` → `npm run build` → `npx playwright test`.

## Envs
`OPENBSP_BASE_URL` (termina em `/rest/v1`), `OPENBSP_API_KEY`, `OPENBSP_PUBLISHABLE_KEY`, `OPENBSP_ORG_ID`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_FB_APP_ID`, `NEXT_PUBLIC_FB_CONFIG_ID`, `DATABASE_URL`, `META_TOKEN_ENCRYPTION_KEY`.

## Contrato do provedor
REST PostgREST com headers `apikey` + `api-key`; edge functions exigem `Authorization: Bearer <sk_>`.
Enviar: `POST /rest/v1/messages`. Ler: `conversations`, `messages`, `contacts_addresses`, `organizations_addresses`, `logs`.
Templates: `PUT` lista, `POST` cria, `PATCH` edita, `DELETE` remove em `whatsapp-management/templates`.

## Ver
`.claude/PROTOCOLO.md` e `BLOQUEIOS.md`.