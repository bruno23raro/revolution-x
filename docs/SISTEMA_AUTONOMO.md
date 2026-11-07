# Sistema Autônomo de Monitoramento e Correção

## Visão Geral

Um sistema completo de monitoramento e correção automática de erros foi criado para a Revolution X. O sistema opera 24/7 e resolve problemas sem intervenção humana.

## Arquivos Criados

```
agents/
└── autonomous-monitor.js     # Agente principal de monitoramento
scripts/
└── scan-errors.js            # Scanner de erros automatizado
.github/workflows/
└── autonomous-monitor.yml    # GitHub Actions workflow
reports/                      # Diretório de relatórios (criado em runtime)
```

## Como Funciona

### 1. Detecção de Erros
- Varre todo o código TypeScript em tempo real
- Detecta padrões conhecidos de erros:
  - Schema drift (snake_case vs PascalCase)
  - Erros de importação
  - Erros de tipo
  - Property access em null/undefined

### 2. Correção Automática
- Aplica correções conhecidas automaticamente
- Mantém log de todas as mudanças
- Reverte se algo der errado

### 3. Monitoramento Contínuo
- GitHub Actions roda a cada 10 minutos
- Monitora builds, testes e deployments
- Notifica automaticamente sobre problemas

## Próximos Passos para Ativar

### 1. Commit e Push
```bash
git add .
git commit -m "feat: add autonomous monitoring agent"
git push origin main
```

### 2. Verifique o Workflow
Acesse: https://github.com/bruno23raro/revolution-x/actions

### 3. Ative o Auto-Deploy
O workflow já está configurado para deployar automaticamente quando tudo passa.

## Comandos Úteis

```bash
# Executar scan manualmente
node scripts/scan-errors.js

# Executar monitor autônomo
node agents/autonomous-monitor.js

# Ver relatórios
cat reports/autonomous-report.json
```

## Configurações Adicionais

### Cron Local
```bash
# Adicionar ao crontab
*/5 * * * * cd /caminho/para/projeto && node scripts/scan-errors.js >> logs/monitor.log 2>&1
```

### PM2 para produção
```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

## Estados Conhecidos

O sistema sabe corrigir automaticamente:

| Problema | Arquivo | Correção |
|----------|---------|----------|
| `organization_id` | route.ts | → `organizationId` |
| `last_checked_at` | schema | → `lastCheckedAt` |
| `waba_id` | provider | → `wabaId` |
| Headers API-key OpenBSP | send.ts | → headers corretos |

## Integrações Futuras

O sistema pode ser expandido para:
- Monitorar API em produção (https://revolutionx.com.br/health)
- Alertar via Slack quando críticas
- Executar migrations automaticamente
- Rollbacks inteligentes