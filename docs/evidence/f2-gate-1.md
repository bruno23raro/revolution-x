# F2 — Gate Final (2026-11-04)

## Status
- **Fase**: 2 ✅ CONFIRMADA
- **Branch**: `refactor/integrations-f2`
- **TypeScript**: 0 erros (`tsc --noEmit EXIT=0`)
- **Lint**: 0 erros
- **Testes**: 833/833 verdes (suítes F1 mantidas + UI novos)
- **ENABLE_META_OAUTH**: OFF ✅ (permanece desligado até Fase 6 fechar)
- **Migration**: 024 aplicada com `user_id` ✅

## O Que Foi Entregue

### 1. IntegrationCard único parametrizado
- Componente `IntegrationCard.tsx` reescrito para aceitar props `channel` e `mode`
- Busca estado do banco via `getByChannel` quando `status` não é passado explicitamente
- 7 estados suportados: `disconnected`, `pending_credentials`, `connecting`, `connected`, `expired`, `error`, `archived`
- Cada estado tem rótulo/ação apropriado (QR code, configurar credenciais, contador 90s, etc.)
- Badge de modo OFICIAL/MANUAL com `supports()`-style verificação
- `aria-label` em todas as ações (canal + modo)
- Contraste de badge verificado, foco visível, `prefers-reduced-motion` no contador

### 2. Rota `/integrations` única
- Substitui os cards fragmentados (WhatsAppApiCard, WhatsAppQrCard, WhatsAppOfficialCard, InstagramCard, FacebookPagesCard)
- Grid único com 6 cards: 3 oficiais + 3 de extração
- Modo `?mode=OFFICIAL|MANUAL` persistente na URL via querystring
- Seletor no topo persiste após reload

### 3. Redirecionamento `/hub-integracoes` → `/integrations`
- `GET /hub-integracoes` → 301 para `/integrations?mode=<valor>` preservando querystring
- Busca por `/hub-integracoes` retorna zero resultados (rota descontinuada)
- Todos os links internos atualizados para `/integrations`

### 4. Bloqueio por modo (T27)
- Badge "OFICIAL" ou "MANUAL" via `supports()` da matriz channel/modo/feature
- Botão no badge troca o modo ancorado no canal (`?mode=...&channel=...`)
- Zero comparação de string de provider em componente — usa `mode` do registro

### 5. Diagnóstico (T28)
- Bloco abaixo dos cards com pendências de credencial, sessões expiradas e falhas das últimas 24h
- Dados lidos de `integration_events` — cada item com link direto para resolver
- Vazio vira estado positivo explícito ("Nenhuma pendência"), não bloco sumido

### 6. Acessibilidade (T29)
- Foco visível nos cards (`focus-visible`)
- `aria-live="polite"` no status da integração
- `aria-label` com canal e modo nas ações (Desconectar WhatsApp conta oficial, etc.)
- Contraste do badge de modo (verde OFICIAL / laranja MANUAL)
- Navegação por teclado nos cards (tabindex ordenado)
- `prefers-reduced-motion` desliga o contador animado de 90s

## Checklist de Verificação (T19+T29 Gate)

- ✅ tsc 0 — TypeScript limpo em todos os arquivos (IntegrationCard.tsx, page.tsx, repository.test.ts)
- ✅ lint 0 — Erros de lint zero
- ✅ 833/833 testes passando — cobertura total F1 mantida, UI validada
- ✅ Teste 301 — rota /hub-integracoes retorna 301 para /integrations?mode= (querystring preservado)
- ✅ Busca por /hub-integracoes retornando zero resultados (rota descontinuada)
- ✅ ENABLE_META_OAUTH OFF — OAuth bloqueado até Fase 6
- ✅ IntegrationCard único parametrizado com 7 estados + modo badge
- ✅ Teste de componente cobrindo os 7 estados nos 6 cards
- ✅ Teste de persistência de modo (?mode= reflete após reload)
- ✅ Teste de que ação grava status real no banco antes de efeito externo
- ✅ Sem OAuth real, sem Evolution, sem Playwright (como ferramenta de teste), sem tela de credenciais expostas
- ✅ Não tocar em ENABLE_META_OAUTH

## Próximos Passos (Fase 3)

- Validar trigger bidirecional mode ↔ connection_mode com transações reais
- Testar constraint única com inserts de teste
- Implementar modo "non_official" com QR code login
- Adicionar suporte para Evolution API manual
- Migração 025 (novas colunas de diagnóstico)