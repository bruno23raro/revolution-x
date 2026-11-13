# Arquitetura — Revolution X

> Status: RASCUNHO. Cada item precisa de caminho de arquivo ou saida de comando.

## 1. Stack
Next 14.2.35, React 18.3.1, TypeScript 5.4.5, Prisma 7.10.1, Supabase self-hosted, Tailwind, Redis/BullMQ, Playwright, jest+vitest.

## 2. Infra local
| Item | Valor |
|---|---|
| Raiz | C:\Users\Bruno\.claude\Revolution\X |
| Postgres do projeto | container x-pg em 127.0.0.1:55432 |
| Postgres nativo (nao usar) | 127.0.0.1:5432 |
| Supabase | 54320/54321 |
| Obsidian REST | 27123 (HTTP) / 27124 (HTTPS) |

## 3. Containers intocaveis
x-pg, rx-n8n, rx-n8n-db, supabase-* (11), freellmapi-freellmapi-1.

## 4. Fluxo WhatsApp
<!-- PREENCHER com o fluxo real lido do codigo: card -> rota -> provider -> openbsp sender -> webhook -> banco -->

## 5. Autenticacao
Lazy auth: `getAuth(req)` devolve `{ user, hasSession }`. Middleware so copia cookie. Rota publica devolve 200 com `available:false`.

## 6. ADRs
### ADR-001 — WhatsApp exclusivamente via OpenBSP
Decisao: nenhuma chamada direta a graph.facebook.com no app.
Motivo: OpenBSP e plataforma aberta e auto-hospedavel que fala direto com a Cloud API da Meta, sem BSP intermediario e sem markup por mensagem; troca de transporte fica em um unico ponto.
Consequencia: acoplamento ao contrato do OpenBSP; exige manter `openbspSender` como unica porta.
Fonte: https://openbsp.dev/ e https://github.com/matiasbattocchia/open-bsp-api

### ADR-002 — Canal nao oficial como fallback
Decisao: usar `open-bsp-whatsmeow` apenas quando o numero nao puder passar por verificacao de negocio.
Motivo: dispensa app review e custo por mensagem, mas aceita risco de banimento.
Fonte: README do open-bsp-api.

## 7. Lacunas
<!-- PREENCHER: o que o OpenBSP nao cobre hoje -->