# PRD — Revolution X

> Status: RASCUNHO. Campos com `<!-- PREENCHER -->` so valem depois de prova em codigo ou HTTP.

## 1. Produto
Plataforma SaaS multi-tenant de atendimento e campanhas em WhatsApp para PMEs brasileiras.

## 2. Personas
- Dono de PME: quer responder cliente rapido, sem perder conversa.
- Atendente: opera fila, templates e etiquetas.
- Admin do tenant: conecta numero, define horario e automacao.

## 3. Jobs to be done
1. Conectar um numero WhatsApp Business com seguranca e sem downtime.
2. Receber mensagem inbound e rotear para o atendente certo.
3. Enviar template aprovado e mensagem de sessao.
4. Acompanhar status de entrega por mensagem.
5. Campanha em massa com controle de custo.

## 4. Escopo do modulo WhatsApp (via OpenBSP)
| ID | Requisito | Criterio de aceite |
|---|---|---|
| W-01 | Conectar canal pelo OpenBSP | POST /api/integrations/openbsp/connect devolve 2xx e grava canal |
| W-02 | Webhook inbound | POST no webhook grava mensagem e dispara roteamento |
| W-03 | Envio de texto em sessao | Envio real devolve id de mensagem |
| W-04 | Envio de template | Template aprovado envia e status vira sent/delivered |
| W-05 | Status por mensagem | Webhook de status atualiza registro |
| W-06 | Desconectar canal | Numero sai da fila e status vira disconnected |
| W-07 | Isolamento por tenant | Tenant A nao le mensagem do tenant B |

## 5. Nao-escopo
- App mobile nativo.
- Voz.
- Marketplace de templates.

## 6. Metricas
<!-- PREENCHER: taxa de conexao bem-sucedida, latencia de inbound, falha de envio -->

## 7. Riscos de produto
- Banimento de numero em canal nao oficial.
- Custo por mensagem fora de controle.
- Rejeicao de template pela Meta.