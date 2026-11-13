# Tarefas — Revolution X

> Ordem obrigatoria: WhatsApp primeiro, ate o fim. Nada de outra area antes de W-10 fechar.
> Colunas: ID | tarefa | prova esperada | veredito | evidencia

## Bloco W — WhatsApp
| ID | Tarefa | Prova esperada | Veredito | Evidencia |
|---|---|---|---|---|
| W-01 | Mapear todo o codigo WhatsApp e dependencias Meta | grep colado, arquivo por arquivo | | |
| W-02 | Fixar contrato unico do `openbspSender` | assinatura real colada | | |
| W-03 | Migrar provider para OpenBSP puro | provider.ts sem campo Meta | | |
| W-04 | Migrar rotas de envio | nenhum import meta/whatsappSender | | |
| W-05 | Migrar rotas de status/connect/callback | contratos JSON preservados | | |
| W-06 | Webhook OpenBSP com validacao | POST real, status colado | | |
| W-07 | Remover card Meta da renderizacao | arquivo preservado, linha comentada | | |
| W-08 | tsc --noEmit | exit 0 | | |
| W-09 | npm run build | exit 0 | | |
| W-10 | grep final sem ocorrencia Meta | zero linhas | | |

## Bloco S — Seguranca e dados
| ID | Tarefa | Prova esperada | Veredito | Evidencia |
|---|---|---|---|---|
| S-01 | RLS por tenant nas tabelas de mensagem | query cruzada entre tenants | | |
| S-02 | Validacao de assinatura de webhook | POST sem assinatura = 401 | | |

## Bloco Q — Qualidade
| ID | Tarefa | Prova esperada | Veredito | Evidencia |
|---|---|---|---|---|
| Q-01 | Testes de envio e inbound | suite verde | | |
| Q-02 | Teste de fallback do searchService | camada 1 falha, camada 2 responde | | |

## Bloco D — Deploy
| ID | Tarefa | Prova esperada | Veredito | Evidencia |
|---|---|---|---|---|
| D-01 | .env.production sem placeholder | validador zerado | | |
| D-02 | CI verde em pull_request | run colado | | |