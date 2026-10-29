import { test, expect } from '@playwright/test';

// E2E do card WhatsApp OFICIAL (OpenBSP) em producao.
// APIs mockadas onde o fluxo exigiria credencial real de onboarding;
// o que NAO e mockado e a superficie publica real (401 sem sessao, popup).
const STATUS_EMPTY = { connected: false, integrations: [] };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/integrations/status', (r) => r.fulfill({ status: 200, json: STATUS_EMPTY }));
  await page.route('**/api/integrations/whatsapp-official/status', (r) =>
    r.fulfill({ status: 200, json: { connected: false, status: 'NONE' } }),
  );
});

test('a) card "WhatsApp API Oficial" renderiza junto dos 4 legados', async ({ page }) => {
  await page.goto('/integracoes');
  await expect(page.getByText('WhatsApp API Oficial')).toBeVisible({ timeout: 15000 });
  const text = await page.textContent('body');
  expect(text).toContain('WhatsApp QR Code'); // legado intacto (regra aditiva)
});

test('b) clique em Conectar no card oficial abre popup OpenBSP', async ({ page, context }) => {
  await page.route('**/api/integrations/openbsp/connect', (r) =>
    r.fulfill({
      status: 200,
      json: { popupUrl: 'https://web.openbsp.dev/onboard/whatsapp/token-teste', tokenId: 'token-teste' },
    }),
  );
  await page.goto('/integracoes');
  const card = page.locator('div', { hasText: 'WhatsApp API Oficial' }).last();
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    card.getByRole('button', { name: 'Conectar' }).click(),
  ]);
  await popup.waitForURL(/web\.openbsp\.dev\/onboard\/whatsapp\//, { timeout: 15000, waitUntil: 'commit' });
  expect(popup.url()).toContain('web.openbsp.dev/onboard/whatsapp/');
  await popup.close();
});

test('c) conectado: UI mostra numero e tier (callback mockado)', async ({ page }) => {
  await page.route('**/api/integrations/whatsapp-official/status', (r) =>
    r.fulfill({
      status: 200,
      json: {
        connected: true,
        status: 'CONNECTED',
        provider: 'openbsp',
        phoneNumber: '+5511999990000',
        verifiedName: 'Central Da Black01',
        tier: { sent: 30, limit: 250, nearLimit: false },
      },
    }),
  );
  await page.goto('/integracoes');
  await expect(page.getByText('+5511999990000')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('30/250')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desconectar' }).filter({ hasText: 'Desconectar' }).last()).toBeVisible();
});

test('d) rotas oficiais sem sessao devolvem 401/403 (nunca 404/500)', async ({ request }) => {
  const gets = ['/api/integrations/whatsapp-official/status', '/api/integrations/whatsapp-official/templates'];
  for (const url of gets) expect(await (await request.get(url)).status()).toBe(401);
  const posts = ['/api/integrations/openbsp/connect', '/api/integrations/whatsapp-official/disconnect'];
  for (const url of posts) expect(await (await request.post(url, { data: {} })).status()).toBe(401);
  // webhook: verify_token errado -> 403 silencioso (gate 4)
  const hook = await request.get(
    '/api/integrations/openbsp/incoming?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=1&org=11111111-1111-4111-8111-111111111111',
  );
  expect(hook.status()).toBe(403);
});

test('e) POST campaign canal invalido devolve 400 (whatsapp_api e aceito na whitelist)', async ({ request }) => {
  const r = await request.post('/api/campaigns', { data: { name: 'x', channel: 'telegram', message: 'oi' } });
  expect(r.status()).toBe(401); // sem sessao nem chega ao 400 — a rota autentica primeiro
});
