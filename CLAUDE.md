# REVOLUTION X — INSTRUÇÃO DE MEMÓRIA

Antes de trabalhar neste projeto, leia `REVOLUTION_X_MEMORY.md`.

Se o usuário disser `REVOLVER`, trate isso como comando para:
- recuperar o contexto persistente;
- ler a memória;
- verificar o estado atual do Git;
- continuar de onde o trabalho parou;
- não reiniciar tarefas já concluídas.

## REGRAS DE AUTONOMIA PERMANENTE

Não interrompa o trabalho para pedir autorização a cada etapa, comando, arquivo ou decisão técnica reversível.

Quando receber um objetivo:
- Analise o estado atual antes de alterar qualquer coisa.
- Monte um plano e execute as etapas em sequência.
- Inspecione arquivos, Git, dependências, scripts, logs e ambiente.
- Corrija erros encontrados e continue até concluir o objetivo ou esgotar as alternativas viáveis.
- Tome decisões técnicas razoáveis com base nas evidências existentes.
- Instale ou ajuste dependências locais quando necessário e permitido, verificando compatibilidade e impactos.

## LIMITES OBRIGATÓRIOS DE SEGURANÇA

### Banco de Dados
- Nunca execute migrations, DDL, exclusões, resets ou testes destrutivos contra produção.
- Nunca utilize `DATABASE_URL`, `DIRECT_URL` ou credenciais do Supabase como fallback para `TEST_DATABASE_URL`.
- Antes de alterar um banco, verifique a identidade do servidor, o nome do banco e o ambiente de destino.
- Execute migrations automaticamente somente em ambientes comprovadamente locais, isolados e destinados a testes, desde que não exista risco relevante de perda de dados.

### Segredos e Dados
- Nunca imprima, copie para relatórios ou exponha senhas, tokens, chaves privadas ou valores secretos de `.env`, `.env.local` e arquivos equivalentes.
- Não enfraqueça autenticação, autorização, isolamento multi-tenant ou políticas RLS para fazer os testes passarem.

### Sistema e Serviços Externos
- Não contorne permissões do sistema, autenticação, MFA, OAuth ou mecanismos de aprovação.
- Não altere domínios, DNS, produção, faturamento ou serviços externos com impacto relevante sem a autorização exigida pelo próprio sistema.

## GIT E INTEGRIDADE DO PROJETO
- Consulte `git status` e os diffs antes de mudanças relevantes.
- Preserve alterações preexistentes.
- Não execute `git reset --hard`, `git clean -fd`, descarte indiscriminado de arquivos ou comandos equivalentes destrutivos.
- Não sobrescreva trabalho do usuário sem necessidade.

## REGRA PARA BLOQUEIOS
Se uma etapa ficar bloqueada:
1. Registre o erro exato sem revelar segredos.
2. Investigue a causa.
3. Tente alternativas seguras e materialmente diferentes.
4. Continue as demais tarefas independentes.
5. Evite repetir tentativas idênticas sem mudança de condições.
6. Só peça ajuda ao usuário quando a próxima ação realmente depender dele.

<!-- qiksy-bridge:start -->
## Browser: Qiksy bridge (`qa_*` tools) — the FIRST browser tool in this project

The `qa_*` MCP tools drive **the browser that is already open**, with the real profile and the
real logins. Full guide: [.claude\qiksy-bridge.md](.claude\qiksy-bridge.md).

**Order of preference, and it is not a tie.** For anything that happens in a browser, reach for
the `qa_*` tools first — every time, including when another browser driver is configured in this
project. Hand over to a different driver only after the bridge has genuinely run out of road, and
only in this order: (1) name out loud which of the two missing capabilities the task needs
(**pixels** or **eval** — see below), (2) look at what the environment actually offers, (3) say
which tool you are switching to and why, (4) go back to the bridge for the rest of the run. A
control that refused, an unfamiliar widget or a slow page is NOT running out of road.

- **Do not switch to another browser driver** (Playwright, Puppeteer, Selenium, CDP) because a
  control looked unfamiliar or refused once. A second driver opens a DIFFERENT, EMPTY browser —
  none of these logins are in it, so the run stops being the test that was asked for.
- Only **one** thing is genuinely absent now: **eval** (no arbitrary
  JS — a Web Store requirement). Need one of them? Say which, and let the human decide.
- **A form is one call**: `qa_fill_json { fields: { "Label": "value" }, advance: "Next" }` — custom
  dropdowns, calendars, cascaders, trees, tags and time included.
- **A control refuses → the ladder**, in order: `qa_probe { name }` (what is this widget and which
  verb drives it) → `raw: true` → `qa_pick_date`/`_time`/`_range`/`_path`/`_tags` → a CSS selector
  (every verb takes one) → `qa_click { name }` and read the `widget` verdict → `qa_focus_tab` if the
  tab is in the background.
- **Reading is free and needs no consent**: `qa_snapshot` (+`geometry:true` for boxes in CSS pixels)
  · `qa_read` · `qa_styles` (computed styles + the design token) · `qa_storage` · `qa_findings`
  (failed requests arrive with the server's error body) · `qa_axe` · `qa_focus_walk`
  · `qa_collect` · `qa_watch`.
- **A TABLE INSTEAD OF A PAGE → `qa_collect`.** Name which nodes (selector / role / nameContains,
  scoped by `within`) and which properties to take — text, value, name, role, tag, selector, href,
  state, geometry, `attr:<name>`, `style:<prop>` — and the answer is that table, once. "Every row
  with its price", "every input with what it holds" is ONE call here and a dozen with snapshot plus
  read. `value` is what a control HOLDS, which a snapshot cannot tell you.
- **SOMETHING HAPPENS LATER → `qa_watch`.** Every other verb answers about NOW, so a toast that
  appears and leaves, a request on a timer, a late row or a live-region announcement are invisible
  to a snapshot taken before or after them, and polling misses the gaps between looks. Start a
  watch (`mutations` · `network` · `console` · `announcements`), do the thing, read the buffer.
  Every watch EXPIRES BY ITSELF — there is no "until stopped", because a watch left running is
  silent and the readings taken after it are the ones that go wrong.
- **ASK REPLIES FOR THE FIELDS YOU WANT.** The big reads take `select` (keep these paths) and
  `omit` (drop these): `qa_snapshot { select: ["nodes[].name","nodes[].ref"] }`. A path that
  matches nothing is reported with the names that ARE there, so a mistyped field costs one call
  rather than a bigger request.
- **THE BRIDGE GENUINELY CANNOT → `qa_gap`.** One sentence saying what was needed, and it lands in
  a file the human reads. This is the sanctioned way out of a dead end; the unsanctioned one — a
  quiet switch to another browser driver — ends the run's meaning. Use it for a missing capability,
  never for a control that refused once (that is the ladder above).
- **Acting** (`qa_click`, `qa_type*`, `qa_fill_json`, `qa_upload`, `qa_navigate`, `qa_reload`, `qa_open_isolated`,
  `qa_mock`) needs the one-time "Agent control" consent in the popup. A refusal there
  is the human's to clear: name the switch and stop, never work around it.
- **A control "disappeared" → look for `modal` in the reply BEFORE filing anything.** While a modal
  dialog or popover is open, the library marks the rest of the page aria-hidden, so the snapshot
  legitimately contains only that layer and `qa_click` legitimately cannot find anything outside
  it. The app is fine. Finish inside the layer, or close it (its own Close/Cancel/OK, or
  `qa_press Escape`) and snapshot again. A regression run once filed fifteen bugs against a
  healthy app for this one reason — none of them survived a re-test.
- **A native browser dialog is NOT clickable by anything** — "Leave site?", confirm(), alert(),
  prompt() are browser chrome, outside the document. Do not hunt for their buttons in the tree
  and do not report them as unreachable controls. `qa_dialogs` decides what they do instead.
- **The server will not produce the failure you need → `qa_mock`**: answer a request from a rule
  (a 500, an empty list, a 30s delay, a dropped connection) instead of waiting for the backend to
  misbehave. It covers the page's own fetch/XHR in the top frame — not documents, subresources,
  WebSocket or iframes. Clear the rules when the check is done; a forgotten mock outlives the
  reason for it and the next thing you measure is a lie.
<!-- qiksy-bridge:end -->
