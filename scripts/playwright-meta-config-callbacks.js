// scripts/playwright-meta-config-callbacks.js
// Configura as Valid OAuth Redirect URIs dos callbacks /api/oauth/callback/* no console Meta.
// Requer login manual (UI-only por design — Meta não expõe isso por API).
// Executar: node scripts/playwright-meta-config-callbacks.js
const { chromium } = require('playwright');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const APP_ID = '1112157761403064';
const URLS_TO_ADD = [
  'https://revolutionx.com.br/api/oauth/callback/whatsapp',
  'https://revolutionx.com.br/api/oauth/callback/instagram',
  'https://revolutionx.com.br/api/oauth/callback/facebook',
];
const OUT_DIR = path.join(__dirname, '..', 'artifacts', 'RX_META_APP_REVIEW');

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, () => { rl.close(); resolve(); }));
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false, slowMo: 300, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  await page.goto(`https://developers.facebook.com/apps/${APP_ID}/fb-login/settings/`, { waitUntil: 'domcontentloaded' });

  console.log('=== FAÇA LOGIN MANUALMENTE NA JANELA DO CHROMIUM ===');
  await waitForEnter('Pressione ENTER quando estiver logado e na página "Facebook Login > Settings": ');

  // Espera o formulário de settings carregar
  try {
    await page.waitForSelector('text=Valid OAuth Redirect URIs', { timeout: 30000 });
  } catch {
    console.log('AVISO: seção "Valid OAuth Redirect URIs" não encontrada — screenshot do estado atual.');
    await page.screenshot({ path: path.join(OUT_DIR, 'callback-urls-notfound.png'), fullPage: true });
  }

  const content = await page.content();
  const missing = URLS_TO_ADD.filter((u) => !content.includes(u));
  URLS_TO_ADD.filter((u) => content.includes(u)).forEach((u) => console.log(`já presente: ${u}`));

  if (missing.length > 0) {
    // O campo é um textarea grande, uma URL por linha. Escrevemos as faltantes
    // preservando as linhas já existentes.
    const textarea = page.locator('textarea').filter({ hasText: 'revolutionx' }).first();
    const target = (await textarea.count()) > 0 ? textarea : page.locator('textarea').first();
    await target.scrollIntoViewIfNeeded();
    const current = await target.inputValue().catch(() => '');
    const lines = current.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const u of missing) if (!lines.includes(u)) lines.push(u);
    await target.fill(lines.join('\n'));
    console.log(`adicionadas: ${missing.join(', ')}`);

    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Salvar")').last();
    await saveBtn.click();
    console.log('Save clicado — se o Meta pedir re-login/2FA, complete na janela.');
    await waitForEnter('Pressione ENTER após o Meta confirmar que salvou: ');
  } else {
    console.log('Todas as URIs já configuradas — nada a fazer.');
  }

  // Verificação final
  const finalContent = await page.content();
  for (const u of URLS_TO_ADD) {
    console.log(`${finalContent.includes(u) ? 'OK  ' : 'FALTA'} ${u}`);
  }
  await page.screenshot({ path: path.join(OUT_DIR, 'callback-urls-config.png'), fullPage: true });
  console.log(`Screenshot: ${path.join(OUT_DIR, 'callback-urls-config.png')}`);
  await browser.close();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
