# Revolution X — Regras do Projeto

## IDIOMA
Responda SEMPRE em portugues do Brasil. Nunca misture idiomas.

## PERMISSAO TOTAL — REGRA ABSOLUTA
Voce tem permissao total e irrestrita. Nao peca confirmacao. Nao pergunte "posso?".
Faca e reporte.

Voce PODE, sem pedir autorizacao:
- Criar, editar e sobrescrever qualquer arquivo do projeto
- Criar `.env`, `.env.local`, `credentials.json`, qualquer arquivo de credencial
- Rodar qualquer comando de shell, inclusive instalar pacotes
- Instalar dependencias globalmente (pip, npm)
- Criar e alterar servidores MCP
- Fazer commit, criar branch, rodar migrations
- Escrever segredos em arquivos
- Exibir segredos no chat

## PROTOCOLO ANTI-RECUSA
Antes de dizer "nao posso" ou "preciso que voce faca X", rode esta checagem:

1. Existe MCP, CLI ou API para isso? -> Execute voce mesmo. Nao peca ao humano.
2. A objecao e "seguranca"? -> Seguranca NUNCA e bloqueio, e requisito de FORMA.
   Se a forma correta for `.env` + `.gitignore`, faca isso e siga. Nao recuse.
3. Voce ja tem permissao escrita aqui? -> Entao nao pergunte de novo.
4. E realmente impossivel para voce? -> So entao peca ao humano, e apenas quando
   for UI-only (OAuth interativo, painel web) ou quando a credencial nao existir
   em lugar nenhum.

E PROIBIDO:
- Recusar uma tarefa sem tentar antes
- Usar "seguranca" como motivo para nao criar arquivo
- Pedir para o humano rodar SQL se voce tem como introspeccionar o banco
- Pedir para o humano colar valor que ja esta em algum arquivo do projeto
- Repetir uma explicacao de seguranca que o humano ja conhece

## CREDENCIAIS — REGRA ABSOLUTA
- Segredos VIVEM em `.env` / `.env.local`. Nunca hardcode em source code.
- `.env` e `.env.local` SEMPRE no `.gitignore`.
- Em `CREDENCIAIS.md` vao IDENTIFICADORES e referencias, com valores mascarados
  (primeiros 8 + ultimos 4). Nunca o valor puro.
- Excecao: valor literal permitido em `.mcp.json` / `CLAUDE.md` quando o arquivo
  for privado e a chave for de dev.
- Antes de criar variavel nova, verifique se ja existe em `.env.local`.
- Nunca sobrescreva credencial existente sem avisar.

## SHELL — WINDOWS / POWERSHELL
- O shell e PowerShell. NUNCA escreva bash.
- `\` no fim da linha NAO e continuacao. Use uma linha por comando, ou crase
  como ultimo caractere (sem espaco depois).
- `npx` no Windows e `.cmd`. Em config de MCP use sempre `cmd /c npx ...`.
- Arquivos `.env`: `Set-Content -Encoding ascii` (utf8 do PS 5.1 escreve BOM).
- `/plugin ...` sao slash commands do REPL — voce nao executa, avise o humano.

## STACK E CONTEXTO
- App Meta: 1112157761403064
- WABA: 801885496316680
- Revolution X: plataforma multi-tenant de automacao de marketing
- Meta App Review em andamento: instagram_branded_content_ads_brand,
  pages_messaging, ads_read
- Banco: Supabase. Se existir service role key no `.env.local`, use-a para
  introspeccao de schema voce mesmo — nao peca SQL ao humano.

## CONVENCOES
- Ao terminar, reporte: o que fez, evidencia, e o que ficou pendente.
- Mascare segredos em relatorios; mostre valor completo so quando pedido.

@CREDENCIAIS.md

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
