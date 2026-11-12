/**
 * Fixtures de dados para testes E2E OpenBSP
 *dados reutilizáveis em múltiplos arquivos de teste
 */

export interface MockOpenBSPAddress {
  address: string // phone_number_id
  extra: {
    waba_id?: string
    access_token?: string
    phone_number?: string
    verified_name?: string
    callback_url?: string
    verify_token?: string
  }
}

export interface MockChannel {
  organizationId: string
  status: 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
  provider: 'openbsp'
  phoneNumber?: string
  verifiedName?: string
  phoneNumberId?: string
  wabaId?: string
  accessTokenEnc?: string
  tier?: { sent: number; limit: number; nearLimit: boolean }
  lastError?: string | null
  onboardingTokenId?: string
  verifyToken?: string
  callbackUrl?: string
}

export interface MockIntegration {
  id: string
  channel: 'whatsapp'
  mode: 'OFFICIAL' | 'MANUAL'
  status: 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
  provider: 'openbsp' | 'meta' | 'evolution'
  phoneNumberId?: string
  phoneNumber?: string
  verifiedName?: string
  wabaId?: string
  accessToken?: string
  metaAccountId?: string | null
  metaAccountName?: string | null
  tier?: { sent: number; limit: number; nearLimit: boolean }
  lastError?: string | null
  expiresAt?: string | null
  externalAccountId?: string | null
  createdAt: string
}

/** ID de organização de teste (UUID válido) */
export const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001'

/** Token de verificação de teste */
export const TEST_VERIFY_TOKEN = 'a'.repeat(64)

/** Phone Number ID de teste (formato OpenBSP) */
export const TEST_PHONE_NUMBER_ID = '123456789012345'

/** WABA ID de teste */
export const TEST_WABA_ID = 'waba_test_12345'

/** Access token de teste */
export const TEST_ACCESS_TOKEN = 'test_access_token_xyz_abc_123'

/** Número de telefone de teste */
export const TEST_PHONE_NUMBER = '+5511999990000'

/** Nome verificado de teste */
export const TEST_VERIFIED_NAME = 'Teste Verificado Ltda'

/** ID de token de onboarding de teste */
export const TEST_ONBOARDING_TOKEN_ID = 'token_test_12345'

/** Mock de canal PENDING (antes da conexão) */
export function createPendingChannel(overrides: Partial<MockChannel> = {}): MockChannel {
  return {
    organizationId: TEST_ORG_ID,
    status: 'PENDING',
    provider: 'openbsp',
    verifyToken: TEST_VERIFY_TOKEN,
    onboardingTokenId: TEST_ONBOARDING_TOKEN_ID,
    callbackUrl: `http://localhost:3000/api/integrations/openbsp/incoming?org=${TEST_ORG_ID}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

/** Mock de canal CONNECTED (após onboarding) */
export function createConnectedChannel(overrides: Partial<MockChannel> = {}): MockChannel {
  return {
    organizationId: TEST_ORG_ID,
    status: 'CONNECTED',
    provider: 'openbsp',
    phoneNumberId: TEST_PHONE_NUMBER_ID,
    phoneNumber: TEST_PHONE_NUMBER,
    verifiedName: TEST_VERIFIED_NAME,
    wabaId: TEST_WABA_ID,
    accessTokenEnc: 'encrypted_token_placeholder',
    tier: { sent: 10, limit: 250, nearLimit: false },
    lastError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

/** Mock de canal DISCONNECTED */
export function createDisconnectedChannel(overrides: Partial<MockChannel> = {}): MockChannel {
  return {
    organizationId: TEST_ORG_ID,
    status: 'DISCONNECTED',
    provider: 'openbsp',
    lastError: 'desconectado_pelo_usuario',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

/** Mock de endereço OpenBSP (response da API) */
export function createOpenBSPAddress(overrides: Partial<MockOpenBSPAddress> = {}): MockOpenBSPAddress {
  return {
    address: TEST_PHONE_NUMBER_ID,
    extra: {
      waba_id: TEST_WABA_ID,
      access_token: TEST_ACCESS_TOKEN,
      phone_number: TEST_PHONE_NUMBER,
      verified_name: TEST_VERIFIED_NAME,
      callback_url: `http://localhost:3000/api/integrations/openbsp/incoming?org=${TEST_ORG_ID}`,
      verify_token: TEST_VERIFY_TOKEN,
    },
    ...overrides,
  }
}

/** Mock de resposta de onboarding token */
export interface MockOnboardingTokenResponse {
  ok: boolean
  tokenId?: string
  popupUrl?: string
  error?: string
  errorDetail?: string
}

export function createOnboardingSuccess(tokenId = TEST_ONBOARDING_TOKEN_ID): MockOnboardingTokenResponse {
  return {
    ok: true,
    tokenId,
    popupUrl: `https://web.openbsp.dev/onboard/whatsapp/${tokenId}`,
  }
}

export function createOnboardingError(error: string, detail?: string): MockOnboardingTokenResponse {
  return {
    ok: false,
    error,
    errorDetail: detail,
  }
}

/** Mock de status de canal */
export function createMockStatus(connected = true, channel: Partial<MockChannel> = {}): Record<string, unknown> {
  const channelData = connected ? createConnectedChannel(channel) : createDisconnectedChannel(channel)
  return {
    connected: channel.status === 'CONNECTED',
    status: channel.status,
    provider: channel.provider,
    phoneNumber: channel.phoneNumber,
    verifiedName: channel.verifiedName,
    tier: channel.tier ?? { sent: 10, limit: 250, nearLimit: false },
  }
}

/** Mock de mensagem enviada */
export interface MockMessageResponse {
  id: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  to: string
  from: string
  timestamp: string
  errors?: Array<{ code: number; title: string }>
}

export function createMockMessage(id = 'msg_test_123', status: string = 'sent'): MockMessageResponse {
  return {
    id,
    status: status as MockMessageResponse['status'],
    to: TEST_PHONE_NUMBER,
    from: TEST_PHONE_NUMBER_ID,
    timestamp: new Date().toISOString(),
  }
}