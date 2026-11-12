/**
 * Helpers para testes E2E OpenBSP
 * Funções de mock, navegação e afirmações reutilizáveis
 */

import { test, expect } from '@playwright/test';
import {
  TEST_ORG_ID,
  TEST_VERIFY_TOKEN,
  TEST_PHONE_NUMBER_ID,
  TEST_WABA_ID,
  TEST_PHONE_NUMBER,
  TEST_VERIFIED_NAME,
  TEST_ONBOARDING_TOKEN_ID,
  createPendingChannel,
  createConnectedChannel,
  createDisconnectedChannel,
  createOpenBSPAddress,
  createOnboardingSuccess,
  createOnboardingError,
  createMockStatus,
  createMockMessage,
} from '../fixtures/openbsp-fixtures';

/**
 * Mock da rota POST /api/integrations/openbsp/connect
 * Retorna popupUrl e tokenId simulados
 */
export async function mockOpenBSPConnect(
  page: Parameters<typeof test>[0]['page'],
  mockFn: (req: import('next/server').NextRequest) => Promise<Response> | null = null
): Promise<void> {
  // Mock da rota de conectar OpenBSP
  await page.route('**/api/integrations/openbsp/connect', async (route) => {
    let body = '';
    try {
      const text = await route.request().text();
      body = text;
    } catch {
      // ignore
    }

    const response = {
      ok: true,
      popupUrl: 'https://web.openbsp.dev/onboard/whatsapp/mock-token-123',
      tokenId: 'mock-token-123',
      mode: 'official',
    };

    if (mockFn) {
      const customResp = await mockFn(route.request);
      if (customResp) return route.fulfill(customResp);
    }

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Mock da rota GET /api/integrations/openbsp/incoming (GET - verificação hub)
 */
export async function mockOpenBSPIncomingGET(
  page: Parameters<typeof test>[0]['page'],
  verifyToken = TEST_VERIFY_TOKEN,
  mode = 'subscribe',
  org = TEST_ORG_ID,
  challenge = 'test-challenge-123'
): Promise<void> {
  await page.route('**/api/integrations/openbsp/incoming', async (route) => {
    const { NextRequest } = require('next/server');
    const req = new NextRequest(
      `http://localhost/api/integrations/openbsp/incoming?hub.mode=${mode}&hub.verify_token=${verifyToken}&hub.challenge=${challenge}&org=${org}`,
      { method: 'GET' }
    );

    // Verificar se o verify_token bate com o do tenant
    // Simples: se tem token e org, retornar o challenge
    const response = {
      ok: true,
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: challenge,
    };

    route.fulfill(response);
  });
}

/**
 * Mock da rota POST /api/integrations/openbsp/incoming (POST - webhook)
 */
export async function mockOpenBSPIncomingPOST(
  page: Parameters<typeof test>[0]['page'],
  mockFn: (payload: unknown) => { status: number; body: Record<string, unknown> } | null = null,
  org = TEST_ORG_ID,
  channelId = TEST_PHONE_NUMBER_ID
): Promise<void> {
  await page.route('**/api/integrations/openbsp/incoming', async (route) => {
    let rawBody = '';
    try {
      rawBody = await route.request().text();
    } catch {
      rawBody = '{}';
    }

    const defaultPayload = {
      entry: [{
        changes: [{
          value: {
            metadata: { phone_number_id: channelId, display_phone_number: '15550001111' },
            messages: [{
              id: 'wamid_test_' + Date.now(),
              from: '551199999988',
              timestamp: String(Date.now()),
              text: { body: 'Olá, mundo!' },
            }],
          },
        }],
      }],
    };

    let payload = defaultPayload;
    if (mockFn) {
      payload = mockFn(rawBody as unknown as string) ?? defaultPayload;
    }

    const response = {
      ok: true,
      status: 200,
      body: JSON.stringify(payload),
    };

    route.fulfill(response);
  });
}

/**
 * Mock da rota GET /api/integrations/openbsp/callback
 */
export async function mockOpenBSPCallbackGET(
  page: Parameters<typeof test>[0]['page'],
  connected = true,
  token = TEST_VERIFY_TOKEN,
  org = TEST_ORG_ID
): Promise<void> {
  await page.route('**/api/integrations/openbsp/callback', async (route) => {
    const response = createMockStatus(connected, { organizationId: org, verifyToken: token });
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Mock da rota POST /api/integrations/openbsp/refresh-token
 */
export async function mockOpenBSPRefreshToken(
  page: Parameters<typeof test>[0]['page'],
  connected = true,
  tokenId = TEST_ONBOARDING_TOKEN_ID,
  org = TEST_ORG_ID
): Promise<void> {
  await page.route('**/api/integrations/openbsp/refresh-token', async (route) => {
    const response = {
      ok: true,
      tokenId: tokenId,
      expiresIn: 60 * 24 * 60 * 60,
    };
    if (!connected) {
      response.ok = false;
      response.error = 'not_connected';
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Clique no botão "Conectar" no card oficial OpenBSP
 */
export async function clickConnectOpenBSP(page: Parameters<typeof test>[0]['page'], channel = 'whatsapp'): Promise<void> {
  await page.getByRole('button', { name: 'Conectar' }).filter({ hasText: channel }).click();
}

/**
 * Navega para a página de integrações
 */
export async function navigateToIntegracoes(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await page.goto('/integracoes');
  await page.waitForLoadState('networkidle');
}

/**
 * Aguarda conexão ser estabelecida (polling)
 */
export async function waitForConnection(
  page: Parameters<typeof test>[0]['page'],
  timeout = 30000
): Promise<{ connected: boolean; phoneNumber?: string; verifiedName?: string }> {
  await page.waitForFunction(
    (fn: (() => boolean)) => fn(),
    undefined,
    async () => {
      try {
        const r = await fetch('/api/integrations/whatsapp-official/status');
        if (!r.ok) return false;
        const data = await r.json();
        return data.connected === true;
      } catch {
        return false;
      }
    },
    timeout
  );

  const r = await fetch('/api/integrations/whatsapp-official/status');
  const data = await r.json();
  return {
    connected: data.connected,
    phoneNumber: data.phoneNumber,
    verifiedName: data.verifiedName,
  };
}

/**
 * Assert se o card WhatsApp API Oficial está visível
 */
export async function assertCardVisible(
  page: Parameters<typeof test>[0]['page'],
  title = 'WhatsApp API Oficial'
): Promise<void> {
  await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });
}

/**
 * Assert se status está conectado
 */
export async function assertStatusConnected(
  page: Parameters<typeof test>[0]['page'],
  timeout = 15000
): Promise<void> {
  await expect(
    page.locator('.text-green-400, .bg-green-600, text:=/Conectado/i')
  ).toBeVisible({ timeout });
}

/**
 * Assert se status está desconectado
 */
export async function assertStatusDisconnected(
  page: Parameters<typeof test>[0]['page'],
  timeout = 15000
): Promise<void> {
  await expect(
    page.locator('.text-red-500, .bg-red-600, text:=/Desconectado|Sem sessão/i')
  ).toBeVisible({ timeout });
}

/**
 * Obter status atual do canal
 */
export async function getChannelStatus(
  page: Parameters<typeof test>[0]['page']
): Promise<{ connected: boolean; status: string; phoneNumber?: string; tier?: { sent: number; limit: number } }> {
  const r = await fetch('/api/integrations/whatsapp-official/status');
  const data = await r.json();
  return {
    connected: data.connected,
    status: data.status,
    phoneNumber: data.phoneNumber,
    tier: data.tier,
  };
}

/**
 * Mock para simular callback bem-sucedido
 */
export async function mockSuccessfulCallback(
  page: Parameters<typeof test>[0]['page'],
  orgId = TEST_ORG_ID,
  tokenId = TEST_ONBOARDING_TOKEN_ID
): Promise<void> {
  // Mock do endpoint callback que simula conexão bem-sucedida
  await page.route('**/api/integrations/openbsp/callback', async (route) => {
    const response = {
      connected: true,
      phoneNumber: TEST_PHONE_NUMBER,
      verifiedName: TEST_VERIFIED_NAME,
    };
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Mock para simular callback com erro
 */
export async function mockFailedCallback(
  page: Parameters<typeof test>[0]['page'],
  reason = 'aguardando_onboarding'
): Promise<void> {
  await page.route('**/api/integrations/openbsp/callback', async (route) => {
    const response = {
      connected: false,
      reason: reason,
    };
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}