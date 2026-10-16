# PROJECT REQUIREMENTS MATRIX — REVOLUTION X (2026-10-15)

> Escopo recuperável + evidência + estado. Regra: NADA aqui é "feito" sem
> evidência objetiva. Estados: `implementado` / `testado-local` /
> `validado-staging` / `aplicado-producao` / `validado-producao`.

## A. Roadmap de 12 FASES (README.md:6-19)

| Fase | Requisito | Módulo/evidência | Teste | Estado local | Estado prod | Pendência |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Inicialização | repo + stack | build 37 pág. | ✅ | ✅ | — |
| 2 | Auth + multi-tenant | Supabase Auth + `public."User"` + membership | auth-security 21; auth rotas | ✅ | ✅ | gap `public."User"` (onboarding fail não derruba registro) |
| 3 | Banco + CRM | `app/api/crm/*` + `crmRepoReal.ts` | suítes CRM | ✅ | ✅ | repositório usa filtro `where` (BYPASSRLS) — documentado |
| 4 | Produtos/mídia | rotas produtos | build | ✅ | ✅ | — |
| 5 | Publicador/calendário | rotas + placeholders UI | build | ✅ | ✅ | — |
| 6 | Vídeo | placeholder `/video` | build | ✅ | ✅ | — |
| 7 | WhatsApp/Meta | webhook + processor + OAuth | meta-idor 8; whatsappProcessor 6 | ✅ | código sim | segredos `META_*` ausentes → inerte |
| 8 | Central de mensagens | tabela `Message` | — | ✅ | ✅ | — |
| 9 | Campanhas | — | — | ❌ ausente | — | fora do escopo recuperável |
| 10 | IA | `omniRouter.ts` | omni-router 6 + admin-routes (SSE) | ✅ | roteador ausente | `OMNIROUTER_*` no Hostinger |
| 11 | Relatórios | `/reports` | build | ✅ | ✅ | — |
| 12 | Segurança/produção | RLS 007/008/009 + 014 + 015 | 41/41 + 10/10 | ✅ | 007–015 ✅ aplicadas (2026-10-15) | rotação credencial |

## B. PROMPT MESTRE (§3–§16) — texto original NÃO está no repo

> Se as seções §1–§16 originais não forem recuperáveis dos registros, registrar
> exatamente o que o usuário deve fornecer. Não inventar conteúdo.

| § | Requisito | Evidência de implementação | Teste | Estado | Pendência |
| --- | --- | --- | --- | --- | --- |
| §3 | UI chat admin | `app/admin/chat/page.tsx` | admin-routes 34 + webhooks 11 | implementado/testado-local/preview (F) | G1 **FECHADO** |
| §4 | OmniRouter | `src/ai/omniRouter.ts` | omni-router 6 | implementado/testado-local | prod: credencial |
| §5 | Ponte local Claude Code | ausente | — | ❌ | escopo novo (alto) |
| §7 | Memória agente | `AgentMemory` + injeção (`chat/route.ts:144-160`) | task-queue 19 + rls 10 | implementado/testado-local/**aplicado-produção** (014) | 014 ✅ em prod |
| §8 | Progresso % SSE real | `taskQueue.ts:139-148` | assert 33→66→100 (rls) + admin-routes | implementado/testado-local | fila 014 ✅ em prod |
| §9 | Fila persistente | `src/lib/taskQueue.ts` | 19 + 10 + admin-routes (list/503/409) | implementado/testado-local/**aplicado-produção** | 014 ✅ em prod |
| §10 | Automação navegador | ausente (sem Playwright) | — | ❌ | escopo novo (alto) |
| §11 | Inventário MCP/CLI | ausente | — | ❌ | escopo novo (baixo-médio) |
| §12 | Hub de integrações | ausente | — | ❌ | escopo novo (médio) |
| §13 | Hub Meta | parcial (OAuth/webhook/processor + claim atômico) | 8 + 6 + webhooks-meta 11 | implementado-parcial/testado-local | segredos + refresh token + UI; **015 ✅ em prod** |
| §14 | Segurança | RLS FORCE + secrets no backend | 41/41 + 21 + admin-routes (authz negativa) | implementado/validado-staging | rotação credencial |
| §15 | Multi-tenant prod | 007/008/009 + 014 + 015 + GUC | 41/41 + 10/10 | **aplicado-producao** (007–015) | rotação credencial |
| §16 | Testes por módulo | forte em `src/` + rotas admin/webhook | **185/185 (18 suítes)** | parcial → melhorado | G7, G12 |

## C. Gaps numerados (G1–G12 do briefing) — status desta missão

| Gap | Descrição | Status 2026-10-15 |
| --- | --- | --- |
| G1 | zero testes em `/api/admin/*` | **FECHADO** (FASE C) — `src/tests/admin-routes.test.ts` (34 testes: authz negativa, ciclos de task, SSE, memory) |
| G2 | jest `roots` só `src` | **FECHADO** (A) — `roots: ['src','app']`; revalidar na suíte completa |
| G3 | race de idempotência no webhook Meta | **FECHADO** (FASE C/D) — claim atômico `ON CONFLICT (meta_event_id)` + migration 015 aplicada e comprovada em produção; 11 testes |
| G4 | 404 `/onboarding/*` pós-OAuth | **FECHADO** (A; confirmado no preview F) — `onboarding/success` e `onboarding/error` 200 |
| G5 | email Resend (nomes de env) | **FECHADO** (A) — code + `.env.example` já consistentes (`EMAIL_API_KEY`); pendência = chave no servidor (E) |
| G6 | `generateState` com `Math.random` | **FECHADO** (A) — CSPRNG `crypto.randomBytes(24)` base64url |
| G7 | URL de onboarding WhatsApp | **ABERTO** — verificar formato oficial Meta antes de mudar |
| G8 | `dotenv` não declarado | **FECHADO** (A) — devDependency ^17.4.2 |
| G9 | rascunhos locais sem gitignore | **FECHADO** (A) |
| G10 | Zernio morto | **DECIDIDO**: manter (MCP zernio ativo na sessão; uso futuro). Sem remoção. |
| G11 | `REVOLUTION_X_MEMORY.md` obsoleto | **FECHADO** (A) — atualizado para 2026-10-15 |
| G12 | prompt-mestre §5/§10/§11/§12/§13 | **ABERTO** (escopo novo P3) |

## D. Item de dependência humana restante

O texto integral do PROMPT MESTRE (§1–§16) **não está em nenhum arquivo do
repositório nem nos docs** (verificado por grep). Se o usuário fornecer o
texto exato, esta matriz será reconciliada seção a seção; até lá, as linhas
acima são o escopo recuperável com evidência.
