# RX_META_APP_REVIEW — Pacote de Auditoria Meta

## O que está neste ZIP

Este pacote contém todo o material necessário para submissão do app Meta (App ID: 1112157761403064) no painel do desenvolvedor.

### Estrutura de Pastas

```
artifacts/RX_META_APP_REVIEW/
  00_LEIA_PRIMEIRO.md        — Este arquivo, instruções gerais
  00_MANIFEST.csv            — Tabela de status de cada item
  01_DOCS/                   — Documentos por permissão e nível
  02_VIDEOS/                 — Vídeos MP4/WebM de cada permissão
  03_EVIDENCIAS/             — Screenshots e evidências de cada passo
  04_APP_LEVEL/              — Níveis de acesso da Marketing API
  05_TRACKING/               — Tracker de chamadas API e submissions
  06_CONSOLE/                — Screenshots do Meta Console (antes/depois/submissão)
```

### 11 Permissões Solicitadas

| # | Permissão | Nível | Status |
|---|-----------|-------|--------|
| 1 | `whatsapp_business_messaging` | A | OK — Core WhatsApp messaging |
| 2 | `business_management` | A | OK — Multi-tenant dependency driver |
| 3 | `ads_read` | A | OK — Ads insights |
| 4 | `pages_show_list` | A | OK — Page listing |
| 5 | `instagram_basic` | A | OK — Instagram profile |
| 6 | `instagram_content_publish` | A | OK — Instagram publishing |
| 7 | `pages_manage_posts` | A | OK — Facebook page posts |
| 8 | `pages_read_engagement` | B | OK — Dependency on `business_management` |
| 9 | `pages_manage_ads` | B | OK — Level B, optional (call recorded) |
| 10 | `pages_read_user_content` | B | OK — Dependency of `instagram_basic` |
| 11 | `whatsapp_business_management` | B | OK — Dependency of `whatsapp_business_messaging` |

### Itens Opcionais / Pendentes

- **Vídeos não gravados ainda**: 10 screencasts necessários (8 Level A + 2 Level B)
- **Scopes removidos do Meta Console**: `ads_management`, `catalog_management`, `manage_app_solution`, `instagram_branded_content_ads_brand`, `facebook_branded_content_ads_brand` (5 removidos)
- **Submissão no Console**: Aguardando 24-72h úteis pela resposta da Meta

### O que está OK

- [x] Análise A/B/C completada (17 permissões classificadas)
- [x] DEFAULT_SCOPES consolidado (1 arquivo canonical)
- [x] Código verificado: tsc 0, lint 0, 712/712 tests passing, build clean
- [x] 5 documentos de auditoria gerados
- [x] Árvore de pastas de saída criada

### O que está PARCIAL / Pendente

- [ ] 10 screencasts ainda não gravados
- [ ] Screenshots do Meta Console (antes/depois/submissão) pendentes
- [ ] Submissão final no painel da Meta (24-72h wait)
- [ ] ZIP final gerado

### Como usar este pacote

1. Comece lendo `00_LEIA_PRIMEIRO.md`
2. Verifique `00_MANIFEST.csv` para status de cada item
3. Grave os 10 vídeos seguindo os scripts em `01_DOCS/`
4. Capture evidências em `03_EVIDENCIAS/`
5. Remova 5 scopes do Meta Console (ver `06_CONSOLE/`)
6. Preencha e submeta o formulário de review
7. Aguarde 24-72h úteis

### Dicas Importantes

- **NUNCA inclua** `.env`, credenciais ou segredos no ZIP
- **Mascare** quaisquer valores sensíveis (primeiros 8 + últimos 4)
- O ZIP contém apenas: docs, vídeos, evidências, screenshots do console
- **Não abortar** por item faltante — o ZIP sempre sai, itens ausentes vão no MANIFEST como AUSENTE/PARCIAL
- Formato de vídeo: 1080p, app window only, no audio, anotações em inglês, 60-120s cada