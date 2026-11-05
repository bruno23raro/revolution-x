# WF-04 alerta-5xx — Diagnóstico e correção de severity

**Sintoma:** workflow n8n WF-04_alerta-5xx falhava intermitente com erro de campo `severity`. Execuções #52/#53 retornaram error, enquanto #54 funcionou. Status report 2026-10-31 indicava “needs fix of severity”.

**Causa raiz:**

1. **Webhook payload envoltório.** O nó Webhook do n8n em `typeVersion:2` entrega o corpo do cliente em `$json.body` e não diretamente em `$json`. O `Enrich Alert` (Function node, `id: enrich_alert`) fazia `const alert = $json;`, portanto `alert.severity` ficava undefined para chamadas de webhook, enquanto para `Error Trigger` funcionava. O fallback interno `alert.statusCode >= 500 ? 'critical' : 'warning'` só entra quando `statusCode` existe, o que nem sempre acontece.

2. **Expressões n8n incompatíveis.** Os nós HTTP `Send WhatsApp Critical` e `Send Slack Alert` usavam expressões de template no `jsonBody` com filtros `| uppercase` (`{{ $json.severity | uppercase }}`) e referência com `={{ $json.severity }}` (sintaxe de Expression node, não do campo JSON). No `jsonBody` de um Http Request, valores JSON devem ser `{{ … }}` sem `=`. Além disso, não havia default.

3. **Payload produtor.** O produtor que aciona `/webhook/alerta-5xx` não é documentado no repo. `grep` não encontra chamadas HTTP a `/alerta-5xx` em `src/`/`app/`. O único fluxo conhecido é o `Error Trigger` interno do n8n. A incerteza do formato do webhook aumentava o risco de `severity` ausente.

**Arquivos alterados:**

- `n8n/workflows/WF-04_alerta-5xx.json`
  - `Enrich Alert` (functionCode): robustez para webhook: `const alert = $json.body || $json;`
  - `Send WhatsApp Critical`: `jsonBody.severity` agora `{{ $json.severity || 'warning' }}`, mensagem usa `($json.severity || 'warning').toUpperCase()` para evitar filtro `| uppercase` não suportado.
  - `Send Slack Alert`: adicionado `severity` ao body e mesmo tratamento de default/uppercase.

**Evidência / file:line**

- `n8n/workflows/WF-04_alerta-5xx.json:39`: Function code antes `const alert = $json;` → agora `const alert = $json.body || $json;`
- `n8n/workflows/WF-04_alerta-5xx.json:93`: jsonBody WhatsApp `severity` com fallback e uppercase em JS
- `n8n/workflows/WF-04_alerta-5xx.json:129`: jsonBody Slack com severity + uppercase em JS

**Como re-testar:**

Sem acesso ao n8n em execução, o comando de teste pronto é:

```powershell
curl.exe -Method POST -Uri "http://localhost:5678/webhook/alerta-5xx" `
  -ContentType "application/json" `
  -Body '{"type":"5xx_error","severity":"critical","message":"Teste","route":"/api/test","statusCode":502}'
```

Ou, se o n8n estiver remoto (hostinger/MCP), substituir `http://localhost:5678` por `https://<n8n-host>/webhook/alerta-5xx`.

Esperado:
- Execution começa → `Enrich Alert` cria `severity` crítico → `Critical Severity?` true → `Send WhatsApp Critical` POST para `https://revolutionx.com.br/api/admin/notify-whatsapp` com header `Authorization: Bearer <ADMIN_ALERT_TOKEN>` e body contendo `severity` = `critical`.
- `AdminAlert` é persistido com severity correta.

**Reexecução pendente:** requer acesso ao n8n (container `rx-n8n` porta 5678 ou instância cloud via MCP). O workflow foi corrigido; reexecução manual deve ser feita pelo humano com o comando acima.

**Passo humano:** validar execução no n8n (MCP cloud ou container local) e confirmar que `AdminAlert` chega com `severity` correto. Se o produtor externo do webhook enviar campos diferentes (`statusCode` etc), ajustar `Enrich Alert` para mapear os campos reais — o código atual já faz fallback para `statusCode >=500`.
