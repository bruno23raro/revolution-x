# PROJECT HANDOFF — REVOLUTION X

> Instruções para retomar o trabalho em uma nova sessão (ou por outra IA).

## Primeiro, sempre

1. Ler `CLAUDE.md` (regras de autonomia + limites de segurança — OBRIGATÓRIOS).
2. Ler `docs/EXECUTION_STATE.md` (fase atual + bloqueios + próximo comando lógico).
3. Ler `docs/EXECUTION_LOG.md` (histórico cronológico de ações/resultados).
4. Rodar `git status` + `git log --oneline -5` e conferir com o checkpoint acima.
5. Rodar `npm test` e `npm run typecheck` para re-validar a base.

## Estado Atual (2026-11-03, pós FASE C + parcial B/A)

### Base ✅ (todos os indicadores verdes)
- **jest 56 suítes / 778 testes PASS** (suíte verde total)
- **tsc 0** — Zero TypeScript errors
- **next lint 0** — Zero warnings
- **build limpo** — 71 rotas (40 API + 31 não-API)
- **Docker stack saudável** — app :3000 + db Postgres17 :15432 (29 tabelas)
- **10 migrations aplicadas em produção** (005–017, todas inclusas)
- **FORCE ROW LEVEL SECURITY** em todas as tabelas `public`
- **Site live** no Hostinger: 200/301-s/robots-s/a11y no ar, build `1981f69` (CI success)
- **CI verde** — Actions run `build-and-test` concluído com sucesso

### O que ficou pronto nesta sessão (2026-11-03)

| Fase | Item | Status |
|------|------|--------|
| **C** | Revisão Git + diff completo (sem segredos) | ✅ |
| **C** | Sanitização `BLOCKERS.md` (chaves n8n mascaradas) | ✅ |
| **C** | Push `1981f69` (3 commits: docs Fase16, PROGRESSO, sanitização) | ✅ |
| **C** | CI monitorado até **success** | ✅ |
| **C** | Smoke tests produção (/, /api/admin/chat, /api/auth/session, login) | ✅ |
| **B** | **H-4 (n8n WF-04)** — webhook testado, exec #75 success, admin alert flow confirmado | ✅ |
| **B** | **H-3 (GoTrue SMTP)** — **RESOLVIDO 2026-10-29** (re-confirmado ao vivo 2026-11-03): `smtp.resend.com:465`, remetente `no-reply@revolutionx.com.br`, `MAILER_AUTOCONFIRM=false`, templates OK, `URI_ALLOW_LIST` cobre produção | ✅ |
| **B** | **H-2 (Facebook Login Review)** — escopo removal pendente no Meta Console | 📋 Preparado |
| **B** | **H-1 (Meta System User Token)** — precisa Business Manager UI | 📋 Preparado |
| **A** | FreeLLMAPI local configurado em `.env.local` (dev ONLY) | ✅ |
| **A** | Testes reais: `/v1/models` (auto, fusion, claude...), `generate` (gpt-oss-120b), fallback chain, rate-limit simulation, auto-select | ✅ |
| **A** | `OMNIROUTER_BASE_URL` + `OMNIROUTER_API_KEY` + `OMNIROUTER_MODEL=auto` em `.env.local` | ✅ |
| **A** | **NÃO** em produção (produção intocada, usa chaves próprias no hPanel) | ✅ |

### Bloqueadores — Ação Humana necessária (prioridade)

| ID | Blocker | Onde agir | O que precisa acontecer |
|----|---------|-----------|------------------------|
| **H-1** | **Meta System User Token** | Meta Business Manager → app `1421814643397349` | Criar usuário do sistema → gerar token `META_SYSTEM_USER_TOKEN_1421814643397349` → salvar em `.env.local` (e hPanel). Steps em `docs/H_BLOQUEIO.md` + `docs/plan_meta_system_user.md`. |
| **H-2** | **Facebook Login Review** | Meta Developer Console → app `1112157761403064` | Remover 8 scopes desnecessários (`ads_management`, `catalog_management`, `instagram_branded_content_ads_brand`, `facebook_branded_content_ads_brand`, `pages_manage_metadata`, `ads_mcp_management`, `pages_messaging`, `whatsapp_business_manage_events`). Submeter review dos 5 restantes + `ads_read`. |
| **H-3** | **GoTrue SMTP (produção)** | Supabase hPanel → Auth → SMTP (projeto `ardpabjoepzhkpmkgwgu`) | **RESOLVIDO 2026-10-29** (re-confirmado ao vivo 2026-11-03): `smtp.resend.com:465`, remetente `no-reply@revolutionx.com.br`, `MAILER_AUTOCONFIRM=false`, templates presentes, `URI_ALLOW_LIST` cobre o callback de produção. Register 201 + e-mail delivered. Nada pendente de configuração. |
| **H-4** | **n8n WF-04 severity** | n8n workflow JSON | **RESOLVIDO 2026-11-03** — severity dinâmica do JSON body, exec #75 success, admin alert persistido. Documentado em BLOCKERS.md. |
| **H-1 técnico** | **Multi-conta Meta por organização** | Código fonte — `src/integrations/meta/` | **TÉCNICAMENTE RESOLVIDO 2026-11-03** — implementação completa: resolvers determinísticos, seletores multicontas, migração 016, 70 testes PASS. Pré-requisito: aplicar migration 016 no Supabase produção (passo humano). |

### Prioridades Próximas

1. **H-1** — System user token (ativa `/api/admin/tasks` com sessão admin → `{count:N}`).
2. **H-2** — Facebook Login review (remove scopes, submete em Meta Console).
3. **H-3** — Fechado ✅ (GoTrue SMTP produção ativo e re-confirmado 2026-11-03).
4. **H-4** — Fechado ✅ (wf-04 severity validado em 2026-11-03).

### Próximos comandos (quando houver disponibilidade)

```bash
# Validar base
npm test       # 778/778 passed
npm run typecheck  # tsc 0
npm run lint   # ✔ No ESLint warnings or errors

# Testes IA local (porta 4000 build)
GET /api/ai/models    → lista modelos (auto, fusion, claude...)
POST /api/ai/generate → {prompt:"teste",task:"chat"} → ok:true + fallbackUsed:false

# Rotinas admin (produção)
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