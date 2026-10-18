# PROJECT REQUIREMENTS MATRIX — REVOLUTION X (2026-10-15)

> Escopo recuperável + evidência + estado. Regra: NADA aqui é "feito" sem
> evidência objetiva. Estados: `implementado` / `testado-local` /
> `validado-staging` / `aplicado-producao` / `validado-producao`.

> ⚠️ **CORREÇÃO DE ESCOPO (2026-10-18)** — Os itens §5 (Ponte local Claude Code)
> e §11 (Inventário MCP/CLI) da reconstrução eram **ferramentas de desenvolvimento**,
> não funcionalidades do produto Revolution X. Reclassificados como **FORA DE ESCOPO**.
> §12 (Hub de integrações) e §13 (Hub Meta) permanecem **em escopo**.
> G12 foi dividido em G12a (fora) e G12b (em escopo).
>
> **ATUALIZAÇÃO 2026-10-18 (PROMPT MESTRE recebido):** O texto original do PROMPT MESTRE
> foi recebido e analisado. As seções §3–§16 da seção B eram uma **reconstrução inventada**
> (os números NÃO correspondem ao documento real). O PROMPT MESTRE tem §1–§8 reais —
> ver seção E para o estado de cada requisito real.
>
> **REFINAMENTO (automação de navegador):** A seção B marcava o "§10 Automação de navegador"
> como FORA DE ESCOPO "sem requisito explícito de produto". Isso foi **corrigido**: o
> PROMPT MESTRE REAL (§2 "Sem API / Avançado", §3.1 e §3.3) EXIGE explicitamente
> *scrapers, QR Code e browser automation* como métodos de produto para logins e
> automações "sem API", com avisos claros de risco. São duas camadas distintas:
> - **Browser automation como MÉTODO da seção "Sem API / Avançado"** = **EM ESCOPO**
>   (funcionalidade real de produto, pendente de autorização; exige avisos de risco).
> - **Playwright/MCP como FERRAMENTA do engenheiro de IA** = permanece **FORA DE ESCOPO**.

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
| §5 | Ponte local Claude Code | ausente | — | ❌ | **FORA DE ESCOPO** (ferramenta de dev, não produto) |
| §7 | Memória agente | `AgentMemory` + injeção (`chat/route.ts:144-160`) | task-queue 19 + rls 10 | implementado/testado-local/**aplicado-produção** (014) | 014 ✅ em prod |
| §8 | Progresso % SSE real | `taskQueue.ts:139-148` | assert 33→66→100 (rls) + admin-routes | implementado/testado-local | fila 014 ✅ em prod |
| §9 | Fila persistente | `src/lib/taskQueue.ts` | 19 + 10 + admin-routes (list/503/409) | implementado/testado-local/**aplicado-produção** | 014 ✅ em prod |
| §10 | Automação navegador (reconstrução — ver seção E) | ausente (sem Playwright) | — | ⚠️ reavaliado | **EM ESCOPO**: "Sem API / Avançado" (§2/§3.1/§3.3 real) exige scrapers/QR/browser automation c/ avisos de risco. Só o Playwright-MCP (ferramenta de dev) continua FORA. |
| §11 | Inventário MCP/CLI | ausente | — | ❌ | **FORA DE ESCOPO** (ferramenta interna de dev, não exposta ao usuário) |
| §12 | Hub de integrações | ausente | — | ❌ | ✅ **EM ESCOPO** (P2-4) — funcionalidade real: status por provider + health + config per-tenant |
| §13 | Hub Meta | parcial (OAuth/webhook/processor + claim atômico) | 8 + 6 + webhooks-meta 11 | implementado-parcial/testado-local | ✅ **EM ESCOPO** (P2-5) — segredos + refresh token + UI; **015 ✅ em prod** |
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
| G12 | prompt-mestre §5/§10/§11/§12/§13 | **REVISADO 2026-10-18** — §5/§11 = FORA (ferramentas de dev); §10 reavaliado: automação "Sem API" = **EM ESCOPO** (ver seção E §2/§3.1/§3.3); §12/§13 = **ABERTO** (em escopo) |

## D. Item de dependência humana restante

**ATUALIZADO 2026-10-18:** O texto integral do PROMPT MESTRE (§1–§8) foi recebido
e fornecido pelo usuário. Ver seção E abaixo para o estado de cada requisito real.

## E. PROMPT MESTRE — Requisitos reais (§1–§8, texto original recebido 2026-10-18)

> O texto original foi fornecido pelo usuário em 2026-10-18. A seção B acima
> (com §3–§16) continha **números inventados** por reconstrução a partir de grep;
> os números reais do PROMPT MESTRE são §1–§8.

### E.1 — Funcionalidades Obrigatórias (§3.1–§3.8)

| Requisito | Descrição | Estado | Evidência |
| --- | --- | --- | --- |
| **3.1a** | Login Instagram via API oficial | ❌ ausente | — |
| **3.1b** | Login Instagram sem API | ❌ ausente | — |
| **3.1c** | Login Facebook via API oficial | ❌ ausente | — |
| **3.1d** | Login Facebook sem API | ❌ ausente | — |
| **3.1e** | Login WhatsApp Business via API Meta | 🟡 parcial | OAuth existe (`app/api/auth/callback/meta`), inerte sem `META_*` credenciais |
| **3.1f** | Login WhatsApp Business via QR Code | ❌ ausente | — |
| **3.1g** | Login TikTok via API | ❌ ausente | — |
| **3.1h** | Login TikTok sem API | ❌ ausente | — |
| **3.2a** | Disparo em massa WhatsApp via API | ✅ backend+UI (F1) | `/api/whatsapp/send` + card de disparo em `/whatsapp` (números→`to[]`, texto ou template; total/sent/failed/tracked) |
| **3.2b** | Disparo em massa WhatsApp via QR | ❌ ausente | — |
| **3.2c** | Templates oficiais sincronizados com Meta | ✅ backend+UI (F1) | `/api/whatsapp/templates` GET/POST + listagem/criação em `/whatsapp` |
| **3.2d** | Selecionar participantes de grupo | ❌ ausente | — |
| **3.2e** | Extrair contatos de grupos | 🟡 declarado (Sem API/Avançado) | card em `/whatsapp` declara + `RiskBanner` (ToS/LGPD); **executor ausente** |
| **3.2f** | Extrair contatos de conversas não salvas | 🟡 declarado (Sem API/Avançado) | idem 3.2e (declarado, sem executor) |
| **3.2g** | Chatbot/robô configurável (fluxos, horários) | ✅ backend+UI (F1) | motor `evaluateChatbot` + CRUD `/api/whatsapp/chatbot` + editor visual em `/whatsapp` (regras/horário/IA) |
| **3.2h** | Automação de respostas automáticas | ❌ ausente | — |
| **3.3a** | Disparo em massa Instagram | ❌ ausente | — |
| **3.3b** | Agendamento posts/stories/reels Instagram | 🟡 stub | `/publisher` (página stub, sem funcionalidade real) |
| **3.3c** | Automações: seguir seguidores/interações | ❌ ausente | — |
| **3.3d** | Extrair contatos de seguidores (scraping) | ❌ ausente | ⚠️ pode violar ToS do Instagram; exige decisão de risco |
| **3.4a** | Agendamento posts Facebook | ❌ ausente | — |
| **3.4b** | Anúncios Marketplace | ❌ ausente | — |
| **3.4c** | Anúncios em grupos (delay configurável) | ❌ ausente | — |
| **3.5a** | Agendamento TikTok | ❌ ausente | — |
| **3.5b** | Tracking campanhas TikTok | ❌ ausente | — |
| **3.6a** | Tracking em tempo real Gerenciador de Anúncios Meta | ❌ ausente | — |
| **3.6b** | Tracking equivalente TikTok | ❌ ausente | — |
| **3.7a** | Integração Meta API (Facebook+IG+WhatsApp) | ✅ backend+UI (F1) | OAuth (início `GET /api/auth/meta` + callback) + webhook + refresh-token + health + status real em `/integrations` |
| **3.7b** | Integração n8n | ✅ backend+UI (F1) | registry + `/api/integrations/config` (baseUrl+apiKey) + webhook inbound + form genérico "Integrar" em `/integrations` |
| **3.7c** | Integração Zapier/Make/webhooks | ✅ backend+UI (F1) | `/api/webhooks/inbound` (secret fail-closed) + registry + form genérico "Integrar" em `/integrations` |
| **3.7d** | Hub de integrações com botão "Integrar" + status | ✅ backend+UI (F1) | `/integrations`: 2 seções (API Oficial / Sem API·Avançado), form "Integrar", health check, refresh-token, status Meta |
| **3.8a** | Chatbot visual configurável (fluxos/condições/variáveis) | ❌ ausente | — |
| **3.8b** | Automações gerais de resposta | ❌ ausente | — |

### E.2 — Princípios de UX (§4) — requisitos de implementação

| Requisito | Estado |
| --- | --- |
| Interface simples, 1 clique, botões grandes | ✅ (design atual usa cards/botões limpos) |
| Fluxos guiados (OAuth, QR Code, wizard) | 🟡 parcial (Meta OAuth início+callback; QR Code ausente; wizard genérico "Integrar" em `/integrations`) |
| Feedback visual imediato (loading/sucesso/erro) | ✅ implementado em páginas existentes |
| Separação visual "API Oficial" vs "Sem API" | ✅ (F1) — `ApiBadge` + 2 seções separadas em `/integrations` (roxo oficial / âmbar sem API) |
| Avisos de risco nas funcionalidades sem API | ✅ (F1) — `RiskBanner` com `riskNote` em cada item "Sem API" + card de extração em `/whatsapp` |

### E.3 — Design Frontend (§5)

| Requisito | Estado |
| --- | --- |
| Paleta lilás + preto + branco | ✅ (lilás/purple já em uso no tema atual) |
| Glassmorphism, gradientes, animações leves | ✅ parcialmente (estilo atual com bordas suaves) |
| Layout responsivo desktop + mobile | ✅ (Tailwind responsive classes) |
| Componentes consistentes (cards, botões, modais, sidebars) | ✅ (AppNav + cards existentes) |

### E.4 — Arquitetura (§6)

| Requisito | Estado |
| --- | --- |
| Next.js + TypeScript + Tailwind + PostgreSQL + Prisma | ✅ implementado |
| Fila de jobs (BullMQ/Inngest ou similar) | 🟡 `taskQueue.ts` (fila interna, não BullMQ) — funcional, sem escala horizontal |
| Separação API oficial vs browser automation | ❌ ausente (não há serviços de browser automation) |
| Logs detalhados + monitoramento de erros | 🟡 logs em console; sem sistema de monitoramento dedicado |

### E.5 — Síntese de pendências reais do produto

| Prioridade | Item | Complexidade |
| --- | --- | --- |
| **P0 [HUMANO]** | Credenciais `META_*`, `EMAIL_*`, `OMNIROUTER_*` no hpanel | Baixa (configuração) |
| **P1** | UI `/crm/pipelines` (já criada nesta sessão ✅) | Baixa (concluída) |
| **P1** | Validar URL de onboarding WhatsApp (G7) | Baixa |
| **P2-4 (§3.7d)** | Hub de integrações: refresh token + health + fluxo guiado "Integrar" — **CONCLUÍDO (F1, backend+UI)** | Concluído |
| **P2-5 (§3.7a)** | Hub Meta avançado: token refresh + health + status detalhado + início OAuth — **CONCLUÍDO (F1, backend+UI)** | Concluído |
| **P2-6 (§3.2)** | WhatsApp Business: disparo em massa + templates + chatbot — **CONCLUÍDO (F1, backend+UI em `/whatsapp`)** | Concluído |
| **P2-7 (§3.7b/c)** | Integrações n8n/Zapier/Make/webhooks: fluxo "Integrar" — **CONCLUÍDO (F1, backend+UI)** | Concluído |
| **P2-8 (§3.3/3.4/3.5)** | Instagram/Facebook/TikTok: agendamento + automações | Alta |
| **P2-9 (§3.6)** | Tracking Gerenciador de Anúncios (Meta + TikTok) | Alta |
| **P3 (§3.8)** | Chatbot visual configurável | Alta |
