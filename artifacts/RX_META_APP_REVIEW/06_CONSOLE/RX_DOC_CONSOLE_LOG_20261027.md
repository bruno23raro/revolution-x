# RX_DOC_CONSOLE_LOG_20261027 — Screenshots e Log do Meta Console

## Regra: Screenshot antes de cada ação

Para cada ação no Meta Developer Console, tirar **printscreen** do estado da página e salvar em:
`06_CONSOLE/RX_EVID_CONSOLE_<acao>_<data>.png`

## Etapas Documentadas

### C.1 Remover 5 Scopes Desnecessários

**Antes:**
- Acessar: `https://developers.facebook.com/apps/1112157761403064/`
- Menu: App Review > Permissions and Features
- **Screenshot**: `RX_EVID_CONSOLE_scopes_antes.png`
- Remover: `ads_management`, `catalog_management`, `manage_app_solution`, `instagram_branded_content_ads_brand`, `facebook_branded_content_ads_brand`
- **Screenshot**: `RX_EVID_CONSOLE_scopes_depois.png`

**After Screenshots:**
- `06_CONSOLE/RX_EVID_CONSOLE_scopes_antes.png`
- `06_CONSOLE/RX_EVID_CONSOLE_scopes_depois.png`

### C.2 Confirmar 11 Permissões no Scope Final

**Ação:**
- Confirmar que as 11 permissões estão presentes:
  1. `whatsapp_business_messaging` (A)
  2. `business_management` (A)
  3. `ads_read` (A)
  4. `pages_show_list` (A)
  5. `instagram_basic` (A)
  6. `instagram_content_publish` (A)
  7. `pages_manage_posts` (A)
  8. `pages_read_engagement` (B)
  9. `pages_manage_ads` (B)
  10. `pages_read_user_content` (B)
  11. `whatsapp_business_management` (B)
- **Screenshot**: `RX_EVID_CONSOLE_submissao.png`

### C.3 Preencher Formulário de Review

**Campos preenchidos:**
- App Name: Revolution X
- App ID: 1112157761403064
- Use Case Description: Do RX_DOC_PADROES_SCREENCAST_20261027.md
- Permissions Justification: Cada permissão com use case concreto
- Video URLs: RX_VID_<permissao>_20261027.webm (10 vídeos)
- Dependencies: `pages_read_user_content` depende de `instagram_basic`; `whatsapp_business_management` depende de `whatsapp_business_messaging`
- Business Verification: N/A (não solicitado)

### C.4 Submeter as Permissões

**Ação:**
- Clicar em "Submit for Review" no painel da Meta
- Preencher todos os campos do formulário
- Anexar 10 vídeos (ou links públicos)
- Preencher justificativas por permissão
- Submeter e aguardar 24-72h úteis

**Screenshot:**
- `06_CONSOLE/RX_EVID_CONSOLE_submissao.png` — estado final do console após submissão

### C.5 Log Completo

**Documentar em** `06_CONSOLE/RX_DOC_CONSOLE_LOG_20261027.md`:
- O que foi clicado em cada página
- Resultado de cada ação (success, error, pending)
- O que ficou pendente
- Screenshots anexados
- Data e hora de cada ação
- ID da submissão (quando disponível)
- Tempo de espera até resposta da Meta

## Formato do Log Entry

```
[data hora] Ação: <descrição>
Resultado: <success|error|pending>
Comentário: <observações>
Screenshot: <caminho do arquivo>
```

Exemplo:
```
2026-10-27 14:30 App Review > Permissions and Features page loaded
Resultado: success
Comentário: Page showing 11 requested permissions
Screenshot: 06_CONSOLE/RX_EVID_CONSOLE_scopes_depois.png
```

## Pós-Submissão

Após submissão, aguardar 24-72h úteis. Monitorar:
- Email do desenvolvedor para notificação da Meta
- Painel do Meta Developer Console: status "Under Review"
- Se houver solicitação de informações adicionais, responder prontamente com:
  - Links dos 10 vídeos
  - Novos screenshots se solicitado
  - Clarificações sobre use cases

Quando receber resposta da Meta:
- **Aprovado**: Atualizar CSV tracker, gerar relatório final, ZIP completo
- **Rejeitado**: Anotar motivos no CSV tracker, gravar vídeos corretivos se necessário, tentar novamente com justificativas melhoradas
- **Pendente**: Continuar monitoramento, responder a quaisquer perguntas adicionais