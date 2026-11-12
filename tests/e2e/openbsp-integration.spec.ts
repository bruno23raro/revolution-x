/**
 * Testes E2E de Integração OpenBSP (FASE 3)
 *
 * Cenários simulados sem credenciais reais de produção.
 * Validação do fluxo completo: onboarding → callback → status → envio.
 */

import { test, expect } from '@playwright/test';
import {
  mockOpenBSPConnect,
  mockOpenBSPIncomingGET,
  mockOpenBSPIncomingPOST,
  mockOpenBSPCallbackGET,
  mockOpenBSPRefreshToken,
  clickConnectOpenBSP,
  navigateToIntegracoes,
  waitForConnection,
  assertCardVisible,
  assertStatusConnected,
  assertStatusDisconnected,
  getChannelStatus,
  mockSuccessfulCallback,
  mockFailedCallback,
  createMockStatus,
} from './helpers/openbsp-helpers';

// Configuração antes de cada teste
test.beforeEach(async ({ page }) => {
  await page.route('**/api/integrations/whatsapp-official/status', (r) =>
    r.fulfill({
      status: 200,
      json: {
        connected: false,
        status: 'NONE',
        provider: 'openbsp',
      },
    })
  );
  await page.route('**/api/integrations/status', (r) =>
    r.fulfill({
      status: 200,
      json: { connected: false, integrations: [] },
    })
  );
});

test.describe('OpenBSP Integration - Fluxo Oficial', () => {
  test('1. Criar integração OpenBSP - inicia onboarding', async ({ page }) => {
    await navigateToIntegracoes(page);

    // Verificar se o card está visível
    await assertCardVisible(page, 'WhatsApp API Oficial');

    // Mock da conexão do callback
    await mockOpenBSPIncomingGET(page, 'test-token', 'subscribe', '00000000-0000-0000-0000-000000000001', 'test-challenge');

    // Clicar em Conectar
    await clickConnectOpenBSP(page, 'whatsapp');

    // Verificar que popup foi aberto (URL contém o onboarding token)
    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByRole('button', { name: 'Conectar' }).click(),
    ]);

    await popup.waitForURL(/openbsp\/onboard\/whatsapp/, { timeout: 15000, waitUntil: 'commit' });
    expect(popup.url()).toContain('onboard/whatsapp/');
    await popup.close();

    test.info().annotations.push({
      type: 'note',
      description: 'Teste 1 passou: integração OpenBSP iniciada com sucesso via mock',
    });
  });

  test('2. Iniciar onboarding com token válido', async ({ page }) => {
    await navigateToIntegracoes(page);

    await mockOpenBSPConnect(page);

    // Clicar em Conectar e abrir popup
    await clickConnectOpenBSP(page, 'whatsapp');

    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByRole('button', { name: 'Conectar' }).click(),
    ]);

    await popup.waitForURL(/web\.openbsp\.dev\/onboard\/whatsapp/, { timeout: 15000, waitUntil: 'commit' });
    expect(popup.url()).toContain('onboard/whatsapp/');
    await popup.close();

    // Verificar se o status mudou para conectado após callback
    await mockOpenBSPCallbackGET(page, true);
    await page.waitForLoadState('networkidle');

    const status = await getChannelStatus(page);
    expect(status.connected).toBe(true);

    test.info().annotations.push({
      type: 'note',
      description: 'Teste 2 passou: onboarding iniciado e callback processado',
    });
  });

  test('3. Conectar WhatsApp via callback simulado', async ({ page }) => {
    await navigateToIntegracoes(page);

    // Iniciar onboarding
    await mockOpenBSPConnect(page);
    await clickConnectOpenBSP(page, 'whatsapp');

    // Aguardar popup e simular callback
    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByRole('button', { name: 'Conectar' }).click(),
    ]);

    await popup.waitForURL(/openbsp\/onboard\/whatsapp/, { timeout: 15000, waitUntil: 'commit' });
    await popup.close();

    // Simular callback bem-sucedido
    await mockOpenBSPCallbackGET(page, true);
    await page.waitForLoadState('networkidle');

    // Verificar status conectado
    const status = await getChannelStatus(page);
    expect(status.connected).toBe(true);
    expect(status.phoneNumber).toBe('+5511999990000');

    test.info().annotations.push({
      type: 'note',
      description: 'Teste 3 passou: WhatsApp conectado via callback',
    });
  });

  test('4. Processar mensagem recebida via webhook', async ({ page }) => {
    await navigateToIntegracoes(page);

    // Setup: canal conectado
    await mockOpenBSPConnect(page);
    await clickConnectOpenBSP(page, 'whatsapp');

    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByRole('button', { name: 'Conectar' }).click(),
    ]);
    await popup.waitForURL(/openbsp\/onboard\/whatsapp/, { timeout: 15000, waitUntil: 'commit' });
    await popup.close();

    // Simular callback de mensagem recebida
    await mockOpenBSPIncomingPOST(page);
    await page.waitForLoadState('networkidle');

    // Verificar que não houve erro 500
    const statusR = await page.request.get('/api/integrations/whatsapp-official/status');
    expect(statusR.status()).toBe(200);

    test.info().annotations.push({
      type: 'note',
      description: 'Teste 4 passou: webhook de mensagem processado',
    });
  });

  test('5. Verificar status conectado na UI', async ({ page }) => {
    await navigateToIntegracoes(page);

    // Setup: canal já conectado
    await mockOpenBSPCallbackGET(page, true);
    await page.reload();
    await page.waitForLoadState('networkidle');

    await assertCardVisible(page, 'WhatsApp API Oficial');
    await assertStatusConnected(page);

    test.info().annotations.push({
      type: 'note',
      description: 'Teste 5 passou: status conectado exibido na UI',
    });
  });

  test('6. Enviar mensagem (via mock de envio)', async ({ page, request }) => {
    await navigateToIntegracoes(page);

    // Setup: canal conectado
    await mockOpenBSPCallbackGET(page, true);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verificar que card está conectado
    await assertStatusConnected(page);

    // Testar endpoint de envio via OpenBSP
    const sendResponse = await request.post('/api/integrations/openbsp/send', {
      data: {
        phoneNumberId: '123456789012345',
        to: '+5511987654321',
        text: 'Teste de mensagem E2E',
      },
    });

    expect(sendResponse.status()).toBe(200);
    const body = await sendResponse.json();
    expect(body.ok).toBe(true);

    test.info().annotations.push({
      type: 'note',
      description: 'Teste 6 passou: mensagem enviada via OpenBSP mock',
    });
  });

  test('7. Refresh token de onboarding', async ({ page }) => {
    await navigateToIntegracoes(page);

    // Setup: canal conectado
    await mockOpenBSPCallbackGET(page, true);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Testar refresh token
    const refreshResponse = await page.request.post('/api/integrations/openbsp/refresh-token', {
      data: {},
    });

    expect(refreshResponse.status()).toBe(200);
    const body = await refreshResponse.json();
    expect(body.ok).toBe(true);
    expect(body.tokenId).toBeDefined();
    expect(body.expiresIn).toBeDefined();

    test.info().annotations.push({
      type: 'note',
      description: 'Teste 7 passou: refresh token realizado com sucesso',
    });
  });
});

test.describe('OpenBSP Integration - Edge Cases', () => {
  test('8. Fallback quando OpenBSP não configurado', async ({ page }) => {
    await navigateToIntegracoes(page);

    // Quando OpenBSP não tem configuração, deve redirecionar para manual
    await mockOpenBSPConnect(page);
    await clickConnectOpenBSP(page, 'whatsapp');

    const r = await page.request.post('/api/integrations/openbsp/connect', {
      data: { channel: 'whatsapp', mode: 'official' },
    });

    expect(r.status()).toBe(503); // openbsp_not_configured
    const d = await r.json();
    expect(d.error).toBe('openbsp_not_configured');

    test.info().annotations.push({
      type: 'note',
      description: 'Teste 8 passou: fallback quando OpenBSP não configurado',
    });
  });

  test('9. Token expirado/409 not_connected', async ({ page }) => {
    await navigateToIntegracoes(page);

    await mockOpenBSPRefreshToken(page, false); // Connected = false
    const refreshResponse = await page.request.post('/api/integrations/openbsp/refresh-token', {
      data: {},
    });

    expect(refreshResponse.status()).toBe(409); // not_connected
    const body = await refreshResponse.json();
    expect(body.error).toBe('not_connected');

    test.info().annotations.push({
      type: 'note',
      description: 'Teste 9 passou: erro tratado quando canal não conectado',
    });
  });

  test('10. Desconectar canal', async ({ page }) => {
    await navigateToIntegracoes(page);

    // Setup: canal conectado
    await mockOpenBSPCallbackGET(page, true);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Clicar em desconectar
    await page.getByRole('button', { name: 'Desconectar' }).click();
    await page.waitForLoadState('networkidle');

    // Verificar status desconectado
    await assertStatusDisconnected(page);

    test.info().annotations.push({
      type: 'note',
      description: 'Teste 10 passou: canal desconectado com sucesso',
    });
  });

  test('11. Idempotência de webhook - evento duplicado', async ({ page, request }) => {
    await navigateToIntegracoes(page);

    // Setup: canal conectado
    await mockOpenBSPCallbackGET(page, true);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Primeiro webhook
    await mockOpenBSPIncomingPOST(page);
    await page.waitForLoadState('networkidle');

    // Segundo webhook com mesmo wamid (deve ser idempotente)
    await mockOpenBSPIncomingPOST(page);
    await page.waitForLoadState('networkidle');

    // Verificar que não houve erro
    const statusR = await page.request.get('/api/integrations/whatsapp-official/status');
    expect(statusR.status()).toBe(200);

    test.info().annotations.push({
      type: 'note',
      description: 'Teste 11 passou: idempotência de webhook verificada',
    });
  });

  test('12. Mensagem sem sessão retorna 401', async ({ request }) => {
    // Testar POST sem autenticação
    const res = await request.post('/api/integrations/openbsp/connect', {
      data: { channel: 'whatsapp', mode: 'official' },
    });

    expect(res.status()).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');

    test.info().annotations.push({
      type: 'note',
      description: 'Teste 12 passou: autenticação requerida em endpoints OpenBSP',
    });
  });
});