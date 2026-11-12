# Plano de Implementação de Testes E2E Playwright - OpenBSP

## 1. Estrutura Atual

### Playwright Config (`playwright.config.ts`)
- **Diretório de testes**: `./tests/e2e`
- **Base URL**: `https://revolutionx.com.br`
- **Reporter**: list + HTML (output: `artifacts/playwright-report/`)
- **Output**: `artifacts/playwright-results/`
- **Projeto**: Chromium Desktop Chrome

### Testes Existentes
- `tests/e2e/whatsapp-official.spec.ts` (8 testes)
- `tests/e2e/integrations-oauth.spec.ts` (7 testes)

## 2. Arquivos a Modificar/Criar

### Novos Arquivos a Criar
```
tests/e2e/openbsp-integration.spec.ts          # Testes completos do fluxo OpenBSP
tests/e2e/helpers/openbsp-helpers.ts             # Helpers de mock e fixtures
tests/e2e/fixtures/openbsp-fixtures.ts           # Fixtures de dados
```

### Arquivos a Modificar
```
playwright.config.ts                              # Adicionar projetos de teste
```

## 3. Plano de Implementação - 12 Cenários OpenBSP

### FASE A: Testes Simulados (Mocks - Sem credenciais reais)

| # | Cenário | Arquivo | Descrição |
|---|---------|---------|-----------|
| 1 | Criar integração OpenBSP | openbsp-integration.spec.ts | POST `/api/integrations/openbsp/connect` - inicia onboarding |
| 2 | Iniciar onboarding | openbsp-integration.spec.ts | Verifica popup URL retornado |
| 3 | Gerar QR Code | integrations-oauth.spec.ts* | Modo non_official sem OpenBSP configurado |
| 4 | Conectar WhatsApp (mock) | openbsp-integration.spec.ts | Simular callback de conexão bem-sucedido |
| 5 | Verificar status conectado | whatsapp-official.spec.ts* | GET `/api/integrations/whatsapp-official/status` |
| 6 | Enviar mensagem (mock) | openbsp-integration.spec.ts | POST via API OpenBSP simulada |
| 7 | Receber mensagem (mock) | openbsp-integration.spec.ts | POST webhook de inbound mockado |

### FASE B: Testes Reais (com credenciais - quando disponíveis)

| # | Cenário | Arquivo | Condição |
|---|---------|---------|----------|
| 8 | Processar webhook real | openbsp-integration.spec.ts | webhook_events testado |
| 9 | Atualizar status canal | openbsp-integration.spec.ts | Testar POST `/disconnect` |
| 10 | Desconectar | whatsapp-official.spec.ts* | POST `/api/integrations/whatsapp-official/disconnect` |
| 11 | Reconectar | openbsp-integration.spec.ts | Fluxo completo conectar→desconectar→reconectar |
| 12 | Renovar tokens | openbsp-integration.spec.ts | POST `/api/integrations/openbsp/refresh-token` |

## 4. Estratégia de Separação

### Testes de Integração (Simulados)
- **Objetivo**: Validar UI e fluxo sem depender de credenciais externas
- **Mock**: APIs OpenBSP, Meta, webhook_events
- **Ambiente**: CI/CD, DEV, TESTES

### Testes de Integração (Reais)
- **Objetivo**: Validar comportamento em ambiente controlado
- **Credenciais**: Variáveis de ambiente `.env.playwright`
- **Separação**: `test.skip` ou tags `@real` para ambientes sem credenciais

## 5. Estrutura de Arquivos

```
tests/e2e/
├── openbsp-integration.spec.ts    # Fluxo completo OpenBSP
├── openbsp-webhook.spec.ts        # Testes de webhook e recepção
├── whatsapp-official.spec.ts      # Expandido (já existe)
├── integrations-oauth.spec.ts     # Expandido (já existe)
├── helpers/
│   └── openbsp-helpers.ts         # Funções de mock, assertions
└── fixtures/
    └── openbsp-fixtures.ts        # Dados de teste reutilizáveis
```

## 6. Helpers e Fixtures

### `openbsp-helpers.ts`
```typescript
// Mocking helpers
export async function mockOpenBSPConnect(request, mockResponse)
export async function mockOpenBSPStatus(request, status)
export async function mockOpenBSPCallback(request, verifyToken)
export async function mockOpenBSPSend(request, result)

// Page helpers
export async function navigateToIntegracoes(page)
export async function clickConnectOpenBSP(page, channel = 'whatsapp')
export async function waitForConnection(page, timeout = 30000)
export function getMockChannelStatus(connected = true)

// Assertions helpers
export async function assertCardVisible(page, title)
export async function assertStatusConnected(page)
export async function assertStatusDisconnected(page)
```

### `openbsp-fixtures.ts`
```typescript
export interface OpenBSPChannel {
  organizationId: string
  status: 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
  provider: 'openbsp'
  phoneNumber?: string
  verifiedName?: string
  phoneNumberId?: string
  wabaId?: string
  accessToken?: string
  tier?: { sent: number; limit: number }
}

export const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001'
export const TEST_VERIFY_TOKEN = 'a'.repeat(64)
export const TEST_PHONE_NUMBER_ID = '123456789012345'

/** Mock de canal PENDING */
export function createPendingChannel(overrides: Partial<MockChannel> = {}): MockChannel { ... }

/** Mock de canal CONNECTED */
export function createConnectedChannel(overrides: Partial<MockChannel> = {}): MockChannel { ... }

/** Mock de canal DISCONNECTED */
export function createDisconnectedChannel(overrides: Partial<MockChannel> = {}): MockChannel { ... }

/** Mock de endereço OpenBSP */
export function createOpenBSPAddress(overrides: Partial<MockOpenBSPAddress> = {}): MockOpenBSPAddress { ... }

/** Mock de resposta de onboarding token */
export function createOnboardingSuccess(tokenId = TEST_ONBOARDING_TOKEN_ID): MockOnboardingTokenResponse { ... }
export function createOnboardingError(error: string, detail?: string): MockOnboardingTokenResponse { ... }

/** Mock de status de canal */
export function createMockStatus(connected = true, channel: Partial<MockChannel> = {}): Record<string, unknown> { ... }

/** Mock de mensagem enviada */
export function createMockMessage(id = 'msg_test_123', status: string = 'sent'): MockMessageResponse { ... }
```

## 7. Configuração do Playwright

### Atualização `playwright.config.ts`
```typescript
export default defineConfig({
  testDir: './tests/e2e',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/playwright-report' }],
    ['json', { outputFile: 'artifacts/playwright-results/results.json' }],
  ],
  outputDir: 'artifacts/playwright-results/',
  use: {
    baseURL: 'https://revolutionx.com.br',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    state: 'started',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'openbsp-mocks',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /openbsp.*\.spec\.ts$/,
    },
  ],
  timeout: 60000,
  retries: process.env.CI ? 2 : 0,
});
```

## 8. Arquivos de Credenciais para Testes

### `.env.playwright` (não versionado)
```bash
NEXT_PUBLIC_APP_URL=https://revolutionx.com.br
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

OPENBSP_BASE_URL=https://...supabase.co/rest/v1
OPENBSP_PUBLISHABLE_KEY=...
OPENBSP_API_KEY=...
OPENBSP_ORG_ID=...

RX_DEMO_MODE=1
```

## 9. Implementação Prioritária

### Sprint 1 (Alta Prioridade)
1. Criar `tests/e2e/helpers/openbsp-helpers.ts` com mocks reutilizáveis
2. Expandir `whatsapp-official.spec.ts` com testes 5, 10
3. Criar `openbsp-integration.spec.ts` com testes 1, 2, 4, 6, 7

### Sprint 2 (Média Prazo)
4. Adicionar testes para webhook idempotency
5. Implementar testes 9, 11
6. Criar `openbsp-webhook.spec.ts` dedicado

### Sprint 3 (Quando credenciais disponíveis)
7. Ativar testes 8, 12 com tags `@real`
8. Configurar CI para pular testes `@real` sem credenciais

## 10. Critérios de Aceitação

### Para Testes Simulados (Mocks)
- [ ] Todos os 12 cenários têm implementação
- [ ] Cada teste passa independentemente (sem dependências de ordem)
- [ ] Mocks são consistentes com a API OpenBSP
- [ ] Screenshots capturados em falhas
- [ ] Artifacts gerados corretamente

### Para Testes Reais
- [ ] Credenciais validadas com `CI=true`
- [ ] Testes `@real` são pulados em CI sem `.env.playwright`
- [ ] Logs de falha incluem detalhes do provedor

## 11. Riscos e Considerações

### Riscos
1. **Popup OpenBSP**: Testes não podem automatizar popup real - usar mock do endpoint `connect`
2. **Webhook async**: O webhook de recebimento precisa de aguardo - usar `waitForResponse`
3. **Rate limiting**: Testes podem ser limitados pelo provedor - implementar retries com backoff

### Considerações
- **Idempotência**: Os testes devem ser idempotentes - não dependem de estado externo
- **Multi-tenant**: Usar org_id de teste fixa para consistência
- **Limpeza**: Após testes com mocks, limpar estado opcionalmente

## 12. Próximos Passos

1. [ ] Criar `tests/e2e/helpers/openbsp-helpers.ts`
2. [ ] Criar `tests/e2e/fixtures/openbsp-fixtures.ts`
3. [ ] Atualizar `playwright.config.ts`
4. [ ] Implementar testes 1-7 (Simulados)
5. [ ] Revisar e validar com build de testes

---

**Data**: 2026-11-09
**Status**: Plano de implementação - Aguardando execução