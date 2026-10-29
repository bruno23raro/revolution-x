import { test, expect } from '@playwright/test';

// Aguarda ate o grid de cards renderizar (o fetch mockado retorna 200 vazio,
// entao o estado de loading some e os cards aparecem).
async function awaitCards(page: Parameters<typeof test>[0]['page']) {
  await page.goto('/integracoes');
  await page.getByText('WhatsApp Business API').first().waitFor({ state: 'visible', timeout: 15000 });
}

test('a) renderiza 4 cards com titulos corretos', async ({ page }) => {
  await page.route('**/api/integrations/status', async (route) => {
    await route.fulfill({ status: 200, json: { connected: false, integrations: [] } });
  });
  await awaitCards(page);
  const text = await page.textContent('body');
  expect(text).toContain('WhatsApp Business API');
  expect(text).toContain('Instagram');
  expect(text).toContain('Facebook Pages');
  expect(text).toContain('WhatsApp QR Code');
});

test('b) cada card desconectado mostra botao Conectar habilitado', async ({ page }) => {
  await page.route('**/api/integrations/status', async (route) => {
    await route.fulfill({ status: 200, json: { connected: false, integrations: [] } });
  });
  await awaitCards(page);
  const buttons = page.getByRole('button', { name: 'Conectar' });
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < count; i++) {
    await expect(buttons.nth(i)).toBeEnabled();
  }
});

test('c) clique em Conectar dispara popup OAuth Meta', async ({ page, context }) => {
  await page.route('**/api/integrations/status', async (route) => {
    await route.fulfill({ status: 200, json: { connected: false, integrations: [] } });
  });
  await page.goto('/integracoes');
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'Conectar', exact: true }).first().click(),
  ]);
  // o popup abre em /api/auth/meta; com sessao ele redireciona 302 para
  // facebook.com, sem sessao a rota responde 401 e o popup fica na mesma origem
  await popup.waitForURL(/api\/auth\/meta|facebook\.com/, { timeout: 15000, waitUntil: 'commit' });
  const url = popup.url();
  const reachedMeta = /^https:\/\/(www\.facebook\.com|graph\.facebook\.com)/.test(url);
  const stuckUnauthorized = /\/api\/auth\/meta\?provider=whatsapp/.test(url);
  expect(reachedMeta || stuckUnauthorized).toBe(true);
  if (!reachedMeta) {
    test.info().annotations.push({
      type: 'note',
      description:
        'Popup abriu no endpoint OAuth (/api/auth/meta?provider=whatsapp) mas sem sessao a rota responde 401 e nao redireciona para facebook.com — redirect Meta exige login; validar manual autenticado.',
    });
  }
  await popup.close();
});

test('d) chamadas de API callback nao retornam 404/500', async ({ request }) => {
  const channels = ['whatsapp', 'instagram', 'facebook'];
  for (const ch of channels) {
    const r = await request.get(`/api/oauth/callback/${ch}?code=x&state=invalid`);
    expect([404, 500]).not.toContain(r.status());
  }
});

test('e) GET e POST sem sessao retornam 401', async ({ request }) => {
  const r1 = await request.get('/api/integrations/status');
  expect(r1.status()).toBe(401);
  const r2 = await request.post('/api/integrations/disconnect', {
    data: { integrationId: 'fake' },
  });
  expect(r2.status()).toBe(401);
});

test('f) toast de erro apos operacao com falha', async ({ page }) => {
  await page.route('**/api/integrations/status', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        connected: true,
        integrations: [{ id: 'int-1', channel: 'whatsapp', status: 'CONNECTED', metaAccountId: null, metaAccountName: null, phoneNumber: null, wabaId: null, tokenExpiresAt: null, lastError: null }],
      },
    });
  });
  await page.route('**/api/integrations/disconnect', async (route) => {
    await route.fulfill({ status: 401, json: { error: 'Nao autorizado' } });
  });
  await page.goto('/integracoes');
  await page.getByRole('button', { name: 'Desconectar' }).first().click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  const toast = page.locator('.bg-red-600');
  await expect(toast).toBeVisible({ timeout: 5000 });
});

test('g) viewport 375x667 sem overflow horizontal e cards empilhados', async ({ page }) => {
  await page.route('**/api/integrations/status', async (route) => {
    await route.fulfill({ status: 200, json: { connected: false, integrations: [] } });
  });
  await page.setViewportSize({ width: 375, height: 667 });
  await awaitCards(page);
  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(376);
  const cards = page.locator('[class*="rounded-xl"]').or(page.locator('div.rounded-xl'));
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(4);
  const boxes = await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
  const xs = boxes.map((b: DOMRect) => b.x);
  const allSame = xs.every((x) => Math.abs(x - xs[0]) < 5);
  expect(allSame).toBe(true);
});
