# Audição de Integrações — Revolution X

## Visão Geral

Auditorado o fluxo de integrações entre WhatsApp (OpenBSP vs Evolution API) e Meta (Facebook/Instagram) em todo o códigobase. O objetivo é entender o roteamento e identificar bugs.

---

## 1. Arquitetura de Integrações

### Tipos e Convenções (src/integrations/types.ts)

- **Channel**: `'whatsapp' | 'instagram' | 'facebook' | 'meta'`
- **Provider**: `'openbsp' | 'evolution' | 'session_login' | 'oauth_meta'`
- **ConnectionMode**: `'official' | 'non_official'`
- **IntegrationRow** tem `mode: 'OFFICIAL' | 'MANUAL'` (legado) e `connection_mode: ConnectionMode`

### Matriz de Capacidades (src/integrations/capabilities.ts / adapter-factory.ts)

| Channel | Mode | Features |
|---------|------|----------|
| whatsapp | official | templates_hsm, messages_template, webhooks_status, perfil_comercial, numero_verificado, multi_atendente, janela_24h |
| whatsapp | non_official | qr_code_login, qr_code_refresh, qr_expiration_monitor, health_check, messages_template, webhooks_status |
| instagram | official | dm_via_graph, comentarios_via_graph, insights, long_lived_token, token_refresh_agendado, pkce_oauth, state_signed |
| instagram | non_official | sessao_persistida, 2fa_checkpoint, validacao_perfil, reconexao_automatica, dm_via_graph, comentarios_via_graph |
| facebook | official | dm_via_graph, comentarios_via_graph, insights, selecao_pagina_facebook, long_lived_token, pkce_oauth, state_signed |
| facebook | non_official | sessao_persistida, 2fa_checkpoint, validacao_perfil, reconexao_automatica, dm_via_graph, comentarios_via_graph, selecao_pagina_facebook |

### Validação Provider ↔ Mode (src/integrations/capabilities.ts)

```typescript
export function validateProviderMode(
  channel: Channel,
  provider: string | null,
  connectionMode: ConnectionMode
): void {
  const expected = OFFICIAL_PROVIDER[channel];
  const validProvider = connectionMode === 'official' ? expected.official : expected.non_official;
  if (provider !== validProvider) {
    throw new Error(`Provider inválido: esperado ${validProvider}, recebeu ${provider}`);
  }
}
```

**OFFICIAL_PROVIDER mapping:**
- whatsapp: official→openbsp, non_official→evolution
- instagram: official→oauth_meta, non_official→session_login
- facebook: official→oauth_meta, non_official→session_login

---

## 2. Fluxo WhatsApp Oficial (OpenBSP)

### Rotas API

| Rota | Descrição |
|------|-----------|
| `POST /api/integrations/openbsp/connect` | Inicia onboarding (mint token OpenBSP) |
| `GET /api/integrations/openbsp/callback` | Polling para verificar conexão após onboarding |
| `GET /api/integrations/openbsp/incoming` | Webhook da Meta Cloud API (callback_url do token) |
| `GET /api/integrations/whatsapp-official/status` | Status do canal OpenBSP |

### Banco de Dados (whatsapp_channels table)

- `provider: 'openbsp'` (string fixo)
- `status: 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'`
- `phoneNumberId`: ID do número da Meta Cloud API
- `wabaId`: ID do WABA (WhatsApp Business Account)
- `accessTokenEnc`: token cifrado (AES-GCM com META_TOKEN_ENCRYPTION_KEY)
- `verifyToken`: token único por tenant (correlaciona organizations_addresses)

### Provider OpenBSP (src/integrations/whatsapp/openbsp/provider.ts)

Dual-path:
1. **Caminho direto Cloud API Meta** - quando o canal tem `phoneNumberId` e `accessToken`
2. **Fallback proxy OpenBSP** (`insert messages` em `messages` table) - quando falta token/phone_number_id

O provider retorna `{ ok, error, via: 'openbsp' | 'meta_direct' }` indicando qual trilha foi usada.

### Adaptador OfficialWhatsAppAdapter (src/integrations/openbsp/adapter.ts)

- `matches(channel, provider, connectionMode)`: `channel === 'whatsapp' && provider === 'openbsp' && connectionMode === 'official'`
- `connect()`: embedded signup → verificar verify_token → registrar webhook → connected
- `send()`: envia template/texto via OpenBSP fallback ou Cloud API direta
- Valida tier 250 msg/24h (gate 2)

### Rotas de Frontend

- `WhatsAppOfficialCard.tsx`: card com botão "Conectar" → abre popup OpenBSP → polling a cada 3s em `/api/integrations/openbsp/callback`
- `IntegrationCard.tsx`: exibe badge OFFICIAL/MANUAL, estado de conexão, tier info

---

## 3. Fluxo WhatsApp OAuth Meta

### Rotas API

| Rota | Descrição |
|------|-----------|
| `GET /api/auth/meta?provider=whatsapp|facebook|instagram` | Inicia OAuth da Meta |
| `GET /api/auth/callback/meta` | Callback OAuth — troca code por tokens |
| `GET /api/oauth/callback/whatsapp` | Callback específico para WhatsApp Business |
| `GET /api/oauth/callback/whatsapp-qr` | QR code pairing (não-oficial) |

### OAuth Meta (src/integrations/meta/auth/oauth.ts)

- `buildMetaAuthUrl()`: constrói URL `https://www.facebook.com/v26.0/dialog/oauth`
- **9 scopes padrão** (src/integrations/meta/constants.ts):
  `pages_show_list`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`, `whatsapp_business_messaging`, `ads_read`, `pages_read_engagement`, `pages_manage_ads`
- `processOAuthCallback()`: valida state, exchange code → tokens, busca páginas/contas Instagram

### Estado do Token

- Persistido em `meta_integrations` table com `provider: 'oauth_meta'`
- Token criptografado (AES-256-GCM) em `encrypted_access_token`
- Multi-contas: 1 linha por página (`meta_page_id`), com `instagram_account_id`
- `token_expires_at` controla validade

### Adaptador MetaOAuthAdapter (src/integrations/meta/oauth-adapter.ts)

- `matches()`: apenas `ch === 'instagram' || ch === 'facebook' || (pr === 'oauth_meta' && cm === 'OFFICIAL')`
- `connect()`: retorna erro `ENABLE_META_OAUTH desligado` se flag não estiver ativada
- `send()`: não implementado — "use quando flag ENABLE_META_OAUTH estiver ligada"

**Flag `ENABLE_META_OAUTH`**: necessária para o adaptador funcionar. Quando desligado, orienta para modo session_login.

---

## 4. Fluxo WhatsApp Evolution API (Não-oficial)

### Service EvolutionService (src/services/evolution/EvolutionService.ts)

- `baseUrl`: `process.env.EVOLUTION_API_URL || 'http://localhost:8080'`
- `apiKey`: `process.env.EVOLUTION_API_KEY || ''`
- Métodos: `createInstance()`, `getInstance()`, `generateQRCode()`, `sendMessage()`, `listConnectedInstances()`, `updateHeartbeat()`, `deleteInstance()`

### Rotas Frontend

- `app/whatsapp/growth/page.tsx`: usa EvolutionService para:
  - Gerar QR code de instância
  - Enviar mensagens
  - Listar membros de grupo
  - FetchAllMembers do grupo

- `app/social/growth/page.tsx`: mesma funcionalidade para growth/social

### Cartão WhatsApp QR (src/components/integrations/WhatsAppQrCard.tsx)

- Gera QR code via `/api/oauth/callback/whatsapp-qr?action=generate`
- Aviso de risco: "Método não oficial — viola ToS da Meta, risco de bloqueio"
- A sessão fica no navegador; proteger o token

---

## 5. Bugs de Roteamento Identificados

### Bug 1: Inconsistência provider ↔ connection_mode

O `whatsapp_channels` table armazena `provider: 'openbsp'` mas não tem `connection_mode`. O `integrations` table tem ambos, mas a lógica de leitura não é consistente.

**Exemplo** (`app/api/integrations/status/route.ts`, linhas 97-118):
```typescript
if (provider === 'openbsp' && phoneNumberId) {
  mode = 'OFFICIAL'; connStatus = 'CONNECTED';
} else if (provider === 'openbsp' && !phoneNumberId && status === 'PENDING') {
  mode = 'OFFICIAL'; connStatus = 'PENDING';
} else if (provider === 'meta_direct' || (provider === 'openbsp' && wabaId)) {
  mode = 'OFFICIAL'; connStatus = 'CONNECTED';  // ← wabaId de provider openbsp?
}
// ... else modo OFICIAL padrão, status DISCONNECTED
```

**Problema**: A lógica assume que `provider === 'openbsp'` → modo `OFFICIAL`, mas não verifica `connection_mode`. Se o modo for `non_official` mas provider for `openbsp`, a UI mostraria incorretamente como oficial.

### Bug 2: Webhook handler mistura fluxos

Em `app/api/integrations/openbsp/incoming/route.ts`:
- Processa webhook da Meta Cloud API
- Chama `processWhatsAppPayload(body, org, tx)` do `meta/whatsappProcessor.ts`
- O payload do webhook OpenBSP deveria ser roteado por `phone_number_id` → tenant
- Mas o processamento chama processor Meta, o que pode causar roteamento incorreto se o webhook for de uma conexão OpenBSP pura (sem token Meta)

**Problema**: O webhook do OpenBSP (via callback_url do onboarding token) termina neste endpoint, mas o processamento assume conexão Meta. Se a conexão for OpenBSP sem token Meta, o processor pode falhar ou processar errado.

### Bug 3: Falha em validar connection_mode em rotas críticas

Várias rotas não consideram `connection_mode` ao determinar status/modal:

- `src/integrations/whatsapp/dispatcher.ts` `checkTier()`: vê `channel.provider` mas não `connection_mode`
- `WhatsAppOfficialCard.tsx`: polling usa `/api/integrations/whatsapp-official/status` que lê `whatsapp_channels` mas não considera modo
- `app/api/integrations/openbsp/callback/route.ts`: verifica `channel.status === 'CONNECTED'` mas não valida modo

**Impacto**: Se usuário tiver conexão `non_official` (Evolution API), a UI ainda pode mostrar botões/estado de "oficial".

### Bug 4: Duas estratégias de conexão desconectadas

1. **OpenBSP**: polling do callback_url + verify_token no banco (`whatsapp_channels`)
2. **Meta OAuth**: postMessage após OAuth flow (`/api/auth/callback/meta`)
3. **Evolution API**: QR code + instância (`/api/oauth/callback/whatsapp-qr`)

Esses três fluxos são independentes:
- OpenBSP usa verify_token único por tenant
- Meta OAuth usa code exchange + tokens da Graph API
- Evolution usa instância + QR code

A UI tenta unificá-los no `IntegracoesPage`, mas a lógica de `forChannel` e `statusFor` não diferencia corretamente.

### Bug 5: Provider `meta_direct` reservado

Em `src/integrations/whatsapp/meta_direct/reserved.ts`:
```typescript
const notReady = {
  ok: false,
  error: 'meta_direct_reserved',
  errorDetail: 'Provedor meta_direct reservado (App Review pendente); use WHATSAPP_PROVIDER=openbsp.',
};
```

O provider `meta_direct` está "reservado" até App Review ser aprovado. O código já tem tratamento para isso, mas se alguém mudar `WHATSAPP_PROVIDER=meta_direct`, o envio falhará explicitamente.

### Bug 6: Termo `mode` inconsistente entre tables

- `integrations` table: `mode: 'OFFICIAL' | 'MANUAL'` (legado, Fase 8)
- `IntegrationRow.connection_mode`: `ConnectionMode` (`'official' | 'non_official'`)
- `whatsapp_channels`: não tem modo, apenas `provider: 'openbsp' | 'meta_direct'`
- UI `IntegrationCard` usa `modeProp` ou `result.mode` do banco

Isso causa confusão: o mesmo canal pode ter `mode='OFFICIAL'` no table `integrations` mas `connection_mode='non_official'` não ser verificado.

### Bug 7: Fábrica de adaptadores incompleta

Em `src/integrations/adapter-factory.ts`:
```typescript
const ADAPTER_REGISTRY: Record<string, (client: any) => IntegrationAdapter> = {
  'whatsapp:openbsp': (client) => new OfficialWhatsAppAdapter(client),
  // 'whatsapp:evolution': (client) => new EvolutionWhatsAppAdapter(client), // não implementado
  // 'instagram:session_login': (client) => new SessionLoginAdapter(client, 'instagram'), // não implementado
  // 'facebook:session_login': (client) => new SessionLoginAdapter(client, 'facebook'), // não implementado
};
```

Somente `whatsapp:openbsp` está no registry. Se `validateProviderMode` encontrar provider `evolution` com modo `official`, lançará `UnsupportedIntegrationError`. O mesmo para providers Meta OAuth sem flag `ENABLE_META_OAUTH`.

### Bug 8: Rota /api/integrations/openbsp/incoming processa webhook Meta incorretamente

O endpoint `POST /api/integrations/openbsp/incoming` foi desenhado para webhook OpenBSP (callback_url do onboarding), mas:
1. Chama `processWhatsAppPayload` do módulo Meta (whatsappProcessor.ts)
2. O `processWhatsAppPayload` espera payload de webhook Meta (entry/changes/value estrutura Meta)
3. Se o webhook for de uma conexão OpenBSP sem token Meta, o processamento falhará ou tratará errado

**Fluxo esperado**: O webhook OpenBSP apenas deveria rotear por `phone_number_id` para o tenant e registrar o evento, não processar como webhook Meta.

---

## 6. Resumo das Rendas

### Onde estão os bugs de roteamento:

1. **Lógica de determinação de mode/status** em `app/api/integrations/status/route.ts` (linhas 97-118) — não considera `connection_mode`, assume `provider === 'openbsp'` = `OFFICIAL`

2. **Webhook handler** em `app/api/integrations/openbsp/incoming/route.ts` — processa webhook como Meta quando deveria ser OpenBSP puro

3. **Validação inconsistente** em `dispatcher.ts` checkTier e outras funções — não considera `connection_mode`

4. **Fábrica de adaptadores incompleta** — só tem `whatsapp:openbsp`, faltam `evolution` e `oauth_meta` adapters

5. **UI não diferencia fluxos** — `IntegracoesPage` trata todos os WhatsApp como um único fluxo, mas há 3 fluxos distintos (OpenBSP, Meta OAuth, Evolution)

6. **Provider `meta_direct` reservado** — código já trata isso, mas a flag não está ativada no ambiente

7. **Termo `mode` confuso** entre `integrations.mode` (OFFICIAL/MANUAL) e `connection_mode` (official/non_official)

### Recomendações:

1. **Unificar a lógica de modo**: criar função `getIntegrationMode(row)` que retorne `ConnectionMode` consistente baseando-se em `provider` + `connection_mode` + credenciais presentes

2. **Separar processamento de webhook**: o `/api/integrations/openbsp/incoming` deve processar apenas como OpenBSP (router por phone_number_id), não chamar processor Meta

3. **Adicionar validação `connection_mode`** em todas as rotas que determinam status/modal

4. **Implementar adapters faltantes**: `EvolutionWhatsAppAdapter`, `SessionLoginAdapter` para Instagram/Facebook

5. **Refatorar UI** para distinguir os 3 fluxos de WhatsApp com labels/estados diferentes

6. **Habilitar flag `ENABLE_META_OAUTH`** se desejar usar OAuth Meta para WhatsApp (ou remover referências se não for usar)

7. **Consolidar o termo `mode`**: decidir se usa `connection_mode` (official/non_official) em todo o códigobase ou migrar para o termo legado `mode` (OFFICIAL/MANUAL) de forma consistente

8. **Adicionar testes** que validem a coerência provider↔mode em todas as rotas e adaptadores