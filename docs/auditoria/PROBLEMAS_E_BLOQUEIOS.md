# PROBLEMAS E BLOQUEIOS — Revolution X

> Classificados por gravidade. Cada item tem evidência e solução concreta.
> (C)rítico = impede funcionamento/continuidade · (A)lto · (M)édio · (B)aixo

## C-1 — SEGREDOS REAIS EM REPO PÚBLICO (crítico, contínuo)

**Evidência**: `git ls-files` rastreia `AUDITORIA.md`, `CREDENCIAIS.md`,
`AUDIT_REPORT_2026-10-27.json`, `inventory-env.md` no `origin/main` de
`github.com/bruno23raro/revolution-x` com `private=false` (verificado via API do GitHub,
2026-11-06). Conteúdo: string de conexão do Postgres de PRODUÇÃO com senha,
`META_APP_SECRET` completo, `META_TOKEN_ENCRYPTION_KEY`, verify token de webhook,
tokens CAPI/system user (parciais), chaves OpenBSP mascaradas ~8/4 (insuficiente),
admin user id. A política em CREDENCIAIS.md literalmente manda "exibir valor completo".
Há histórico de "fix: remove secrets from repo" (306bb91) sem purga de histórico.

**Por que é o problema nº 1**: com a chave AES-GCM + acesso ao banco, qualquer pessoa lê
todos os tokens OAuth de todos os tenants (Meta/WABA/OpenBSP/TikTok) — sequestro total de
contas dos clientes. Com a string de conexão, lê/escreve em tudo (service_role não é
proteção no Postgres direto).

**Solução (ordem exata)**:
1. Tornar o repo privado AGORA (1 clique, zero risco) — depois decide-se a purga.
2. Revolver TODAS as credenciais expostas: senha Postgres (Supabase), `META_APP_SECRET`
   (Meta gera novo), `META_TOKEN_ENCRYPTION_KEY` (=> recriptografar tokens existentes com
   re-encrypt script, ou exigir re-login dos tenants), webhook verify token (registro na
   Meta), Resend API key, OpenBSP API key, tokens CAPI/system user, `CRON_SECRET`,
   `ADMIN_ALERT_TOKEN`, JWT_SECRET, service_role key.
3. Purgar histórico (git filter-repo/BFG) + force-push + aceitar que o que foi público
   permanece vazado — a revogação (2) é o que importa.
4. Reescrever a política de credenciais de CLAUDE.md/AGENTS.md (identificadores +
   últimos 4 apenas; NUNCA "valor puro"; segredo nunca em doc versionado).
5. CI com scanner de segredos (gitleaks) bloqueando push.

## C-2 — ISOLAMENTO RLS EM PRODUÇÃO MUITO ABAIXO DO DOCUMENTADO (crítico)

**Evidência** (introspecção direta no banco de produção, 2026-11-06): 41 tabelas;
RLS FORÇADO em apenas 5 (`AdminAlert, growth_leads, integrations, whatsapp_instances,
integration_events` [enable sem force]); **6 policies** no total. Documentos de auditoria
antigos (e o próprio README/HANDOFF) afirmam "FORCE RLS em todas as tabelas public" com
41+10 policies. Cadeia 007/008/009 NÃO está no banco atual — o "restore production schema
after db reset" (commit b4d2426) recriou o schema sem as policies de tenant.
Enquanto isso, várias rotas usam `service_role` (que ignora RLS) e alguns repos usam
BYPASSRLS: o isolamento hoje é **somente disciplina de código**.

**Solução**: reescrever/aplicar a cadeia de tenant-policies (modelo `app.current_org` GUC,
007-like) para TODAS as tabelas com `organization_id`; `ALTER TABLE ... FORCE ROW LEVEL
SECURITY`; suíte de autorização negativa por rota (padrão já existe: meta-idor, rls tests);
reduzir service_role ao mínimo (webhooks/onboarding) com revisão rota a rota.

## C-3 — FLUXO OAUTH META QUEBRADO NO HEAD (crítico para o produto)

**Evidência**: `app/api/auth/callback/meta/route.ts` deletado em `1a87fc7` ("chore: update
project rules and execution state" — commit de 200+ arquivos de skills de agentes que
carregou a destruição junto). `app/api/auth/meta/route.ts` continua gerando
`redirect_uri=/api/auth/callback/meta`; o teste `route.test.ts` ficou órfão e quebra a
suíte. A geração nova `/api/oauth/callback/{facebook,instagram,whatsapp,whatsapp-qr}` não
é referenciada por nenhum init/UI. `ENABLE_META_OAUTH=false`.
**Impacto**: nenhum usuário consegue conectar IG/FB/WABA por OAuth hoje (e quando o review
Meta aprovar, continuarão sem conseguir).
**Solução**: decidir UMA geração (recomendo consolidar na nova `oauth/callback/*`),
apontar o init, restaurar/adaptar os testes, apagar a geração morta. ~1 dia.

## C-4 — MAIN DE DESENVOLVIMENTO QUEBRADA / WIP NÃO COMMITADO (crítico operacional)

**Evidência**: `npx tsc --noEmit` → 2 erros de SINTAXE em `app/integracoes/page.tsx`
(`{(>` e `)}}` — digitação corrompida); jest 1 suíte + 1 teste falhando; branch atual
`refactor/db-adapter-f1` com 8 commits à frente de `origin/main` (produção foi feita dela,
mas o deploy mais novo inclui o build fix `88625c6`? — produção foi feita de 288dd66);
branch `main` local divergida. `package.json` com dependência suspeita não utilizada:
`@qoder-ai/qoder-agent-sdk` (SDK de agente de IA em dependências de produção!).
**Solução**: (1) reverter o WIP de `page.tsx` para o estado commitado ou terminar o
ChannelPicker corretamente; (2) restaurar callback → suíte verde; (3) remover
qoder-agent-sdk; (4) consolidar as branches refactor na main e redesplegar; (5) regra:
nenhum commit "chore" mistura skills de agentes com código de app.

## A-1 — DOCUMENTOS DE ESTADO MENTEM SOBRE O PRESENTE (alto)

**Evidência**: "778/778", "833/833 testes" e "RLS em todas as tabelas" nos docs de handoff
vs. medição de hoje: 822 testes, 1 falha, 2 suítes quebradas (1 órfã), tsc 2 erros, RLS 5/41.
Isto induz o humano (e futuras sessões de IA) a aprovar decisões sobre realidade falsa.
**Solução**: STATUS_GERAL.md (criado nesta auditoria) como fonte única, com data+commit+
medição; docs antigos marcados como históricos.

## A-2 — SCRAPERS "SEM API" SIMULAM RESULTADO (alto)

**Evidência**: `ScraperPageLayout.tsx:32-34` gera `[PLACEHOLDER] Extração iniciada...` como
se fosse o resultado; 5 páginas vivem em `src/app/scrapers/**` (fora da raiz do App Router —
provavelmente NEM roteizam, só `app/scrapers/instagram-profile` roteiza) e 1 em `app/`.
Executores reais dos itens §3.2e/3.2f/3.3c/3.3d/3.4b/3.4c não existem.
**Impacto**: usuário leigo vê "extração iniciada" e acredita que a operação existe.
**Solução honesta**: estado "em breve / não disponível" na UI (não resultado simulado);
se for implementar, fazer executor real com fila + RiskBanner + logs LGPD. Decisão D-4.

## A-3 — DUPLICAÇÃO DE ÁRVORES E ATIVOS MORTOS (alto)

**Evidência**: `src/app/**` vs `app/**` (páginas scrapers duplicadas/quebradas);
`migrations/` (raiz) vs `supabase/migrations/`; `srcmodules/`, `graft/`, `routes/`, `db/`,
`data/` vazios ou legados; ~50 diretórios de ferramentas de agentes (`.adal`, `.augment`,
...) commitados; logs de cookies/sessões na raiz (cookies.txt etc. — `.txt` está
gitignored, mas `temp_check.txt` versionado? não — ok); `package-lock` 475 KB com
playwright+puppeteer como dependências de PRODUÇÃO do app Next (incha build/host).
**Solução**: housekeeping em fase dedicada (FASE 8 do plano), sem quebrar nada: mover
scrapers p/ `app/`, arquivar migrations antigas, `git rm -r --cached` dos dirs de agentes
+ .gitignore, mover playwright/puppeteer/qoder-sdk para devDependencies ou remover.

## A-4 — MIGRATIONS FORA DO PRISMA MIGRATE (alto)

**Evidência**: `_prisma_migrations` tem 2 linhas; 24 arquivos SQL aplicados manualmente;
dois arquivos para a "024" (`024_integrations_v2.sql` e timestamp `20261104153012`);
duas "017" e "020" com nomes diferentes; 016_rollback/017_rollback soltos.
**Impacto**: nenhuma garantia de paridade local↔produção; deploys futuros podem quebrar
silenciosamente (foi a causa de vários episódios documentados, ex.: "restore schema after reset").
**Solução**: baseline do Prisma Migrate sobre o schema atual de produção (ou adotar
`supabase` CLI/deno com ledger), renomear duplicatas, CI aplicando a cadeia num Postgres
descartável a cada PR.

## A-5 — PRODUÇÃO SEM NENHUM TENANT OPERACIONAL DE VERDADE (alto)

**Evidência**: `meta_integrations` = 0 linhas; `whatsapp_channels` idem (por tabela de
canais, sem canal conectado); ou seja: o produto está publicado, mas NENHUMA conta de
cliente percorreu o fluxo completo conectar→publicar→responder.
**Solução**: piloto end-to-end com 1 organização de teste (após C-3/C-1): conectar OpenBSP,
enviar template, disparar auto-reply, ver inbox, relatório. É o teste que valida tudo.

## A-6 — n8n API 401 crônico (alto para automações de produção)

Ver AUDITORIA_INTEGRACOES §8. WF-02 (retry CAPI) e WF-05 (poll) são infraestrutura do
produto; hoje dependem de MCP cloud manual. Corrigir auth do container ou internalizar.

## A-7 — Dependências de produção infladas/suspeitas (médio-alto)

`playwright`, `puppeteer`, `puppeteer-core` (100+ MB de browsers no runtime do SaaS) e
`@qoder-ai/qoder-agent-sdk` (não usado por rota alguma) em `dependencies`. Além de custo/
superfície de ataque, poluem o deploy Hostinger. Mover para dev ou remover.

## M-1 — Fila/escala (médio)
taskQueue Postgres + cron HTTP: ok para dezenas de tenants; sem concorrência de workers,
sem DLQ visível. Tick multi-tenant serial. Aceitável agora; BullMQ quando >~50 tenants ativos.

## M-2 — Monitoramento (médio)
Sem APM/persistência de logs; alertas 5xx via n8n WF-04 funcionam (exec #75) mas dependem
do n8n local no host de dev — em produção o fluxo precisa apontar para uma instância
sempre-on. Sem uptime monitoring externo do domínio.

## M-3 — GoTrue `SITE_URL=http://localhost:3000` em produção (médio)
Registrado no PROGRESSO 2026-11-03. Corrigir no hPanel (1 campo). [HUMANO]

## M-4 — Migration 016/02x em produção (médio, parcialmente resolvido)
Introspecção de hoje: colunas da 016 (display_name) e 024/025/026/027 PRESENTES em
produção. O bloqueio "016 pendente" dos docs está **obsoleto** —docs desatualizados
(reforço de A-1). Falta formalizar via ledger (A-4).

## M-5 — Falta suíte E2E de fluxo real (médio)
Jest cobre unidades/rotas com mock. Nenhum teste ponta a ponta autenticado com o app
rodando (playwright.config existe, specs de fluxo não). É o que pegaria C-3/C-4.

## B-1 — Pendências humanas externas (baixo para código, alto para go-live)
H-1 System User Token (Business Manager) · H-2 App Review Meta (em análise desde 31/10) ·
credenciais META_*/OMNIROUTER_* confirmadas no hPanel · SITE_URL GoTrue · cron Hostinger
(CRON_SECRET + POST /api/cron/tiktok) · Evolution API instância (se modo QR ficar).

## B-2 — Cosméticos/documentais
favicon 404; `Novo(a) Documento de Texto.txt` vazio; backups/sufixos `.bak-*` de CLAUDE.md;
5 CLAUDE.md diferentes; worktrees esquecidos (9); `execution-state.json` na raiz fora do
padrão de `docs/`.
