# PROJECT HANDOFF — REVOLUTION X

> Instruções para retomar o trabalho em uma nova sessão (ou por outra IA).

## Primeiro, sempre

1. Ler `CLAUDE.md` (regras de autonomia + limites de segurança — OBRIGATÓRIOS).
2. Ler `docs/EXECUTION_STATE.md` (fase atual + bloqueios + próximo comando lógico).
3. Ler `docs/EXECUTION_LOG.md` (histórico cronológico de ações/resultados).
4. Rodar `git status` + `git log --oneline -5` e conferir com o checkpoint acima.
5. Rodar `npm test` e `npm run typecheck` para re-validar a base.

## Estado Atual (2026-11-01)

### Base ✅ (todos os indicadores verdes)
- **jest 56 suítes / 778 testes PASS** (suíte verde total)
- **tsc 0** — Zero TypeScript errors
- **next lint 0** — Zero warnings (2 avisos pré-existentes corrigidos)
- **build limpo** — 71 rotas (40 API + 31 não-API)
- **Docker stack saudável** — app :3000 + db Postgres17 :15432 (29 tabelas)
- **10 migrations aplicadas em produção** (005–017, todas inclusas)
- **FORCE ROW LEVEL SECURITY** em todas as tabelas `public`
- **Site live** no Hostinger: 200/301-s/robots-s/a11y no ar, build 01a17a4b

### O que ficou pronto nesta rodada

| Item | Status |
|------|--------|
| Lint warnings `FacebookPagesCard.tsx` + `WhatsAppQrCard.tsx` | ✅ Corrigidos |
| `docs/PROJECT_HANDOFF.md` criado/atualizado | ✅ Feito agora |
| `docs/H_BLOQUEIO.md` (Meta Console steps) | ✅ Existente |
| `plan_meta_system_user.md` atualizado | ✅ Existente |
| `docs/N8N.md` documentado | ✅ Existente |
| Workflows WF-01/02 ativas | ✅ Confirmado |
| Admin bearer auth com prefixo duplicado tolerado | ✅ Verificado |
| Schema drift reportado (`hasDrift:true`) | ✅ Documentado |
| Migrations 005–017 aplicadas | ✅ Confirmado |
| Meta App Review: 4/4 approved, Marketing API 500/500 | ✅ Aprovado |

### Bloqueadores — Ação Humana necessária

| ID | Blocker | Onde agir | O que precisa acontecer |
|----|---------|-----------|------------------------|
| **H-1** | **Meta System User Token** | Meta Business Manager → app `1421814643397349` | Criar usuário do sistema → gerar token `META_SYSTEM_USER_TOKEN_1421814643397349` → salvar em `.env.local`. Steps no `docs/H_BLOQUEIO.md`. |
| **H-2** | **Facebook Login Review** | Meta Developer Console → app `1112157761403064` | Remover 8 scopes desnecessários (`ads_management`, `catalog_management`, `instagram_branded_content_ads_brand`, `facebook_branded_content_ads_brand`, `pages_manage_metadata`, `ads_mcp_management`, `pages_messaging`, `whatsapp_business_manage_events`). Submeter review dos 5 restantes + `ads_read`. |
| **H-3** | **GoTrue SMTP** | Supabase hPanel → Auth → SMTP | Configurar host, port 587, usuário, senha, remetente `no-reply@revolutionx.com.br`. Testar register flow (400 → OK). |
| **H-4** | **WAF-04 severity** | n8n workflow JSON | Ja foi fixado (severity passa dinâmica do corpo JSON). Verificar execuções via MCP cloud ou Docker. |

### Prioridades Próximas

1. **H-1** — System user token (ativa `/api/admin/tasks` com sessão admin → `{count:N}`).
2. **H-3** — GoTrue SMTP (resolve 400 no cadastro `register`).
3. **H-2** — Facebook Login review (remove scopes, submete em Meta Console).
4. **H-4** — Workflows via MCP cloud (documentado: local REST API 401 blocker).

### Próximos comandos (quando houver disponibilidade)

```bash
# Validar base
npm test       # 778/778 passed
npm run typecheck  # tsc 0
npm run lint   # ✔ No ESLint warnings or errors

# Rotinas admin (portas 3000/4000)
GET /api/admin/alerts        → 401 sem token; 200 com Bearer válido
GET /api/admin/tasks         → depende de sessão admin (H-1)
GET /api/admin/schema/diff   → 200 com drift data
```

## Estrutura de memória persistente

`memory/` — arquivos individuais com frontmatter (um fato por arquivo). Consulte `MEMORY.md` para o índice.

## Regras críticas

- Segredos VIVEM em `.env` / `.env.local`. Nunca hardcode em source code.
- `.env` e `.env.local` SEMPRE no `.gitignore`.
- Em `CREDENCIAIS.md` vao IDENTIFICADORES e referencias, com valores mascarados (primeiros 8 + ultimos 4).
- Nunca sobrescreva credencial existente sem avisar.
- Commits terminam com `Co-Authored-By: Claude Code <noreply@anthropic.com>`.