// Extração de sessão via login em navegador headless (Playwright) — modo MANUAL.
//
// Fluxo: usuário informa email/senha → abrimos a tela de login REAL da
// plataforma (instagram.com / facebook.com) em contexto isolado → preenchemos
// → aguardamos cookie de sessão → devolvemos o storageState (cookies+LS) que é
// cifrado e salvo como credencial da conta MANUAL.
//
// Honestidade e limites (shortcut documentado):
//  * Não burlamos 2FA/checkpoint: se a plataforma pedir verificação, devolvemos
//    needs_2fa e o usuário deve conectar via API oficial ou colar cookie próprio.
//  * Senha é usada APENAS nesta execução; nunca é persistida em lugar algum.
//  * Toda tentativa passa pelo riskLogger (auditoria de automação não-oficial).

export type LoginPlatform = 'instagram' | 'facebook';

export type ManualLoginResult =
  | { ok: true; storageState: string; sessionCookie: string }
  | { ok: false; reason: 'bad_credentials' | 'needs_2fa' | 'login_unreachable' | 'timeout'; detail?: string };

interface PlatformSpec {
  loginUrl: string;
  userSelectors: string[];
  passSelectors: string[];
  submitSelectors: string[];
  successCookie: string;
  challengeHints: string[];
}

const SPECS: Record<LoginPlatform, PlatformSpec> = {
  instagram: {
    loginUrl: 'https://www.instagram.com/accounts/login/',
    userSelectors: ['input[name="username"]', 'input#loginForm input', 'input[type="text"]'],
    passSelectors: ['input[name="password"]', 'input[type="password"]'],
    submitSelectors: ['div[role="dialog"] input[type="submit"]', 'input[type="submit"]', 'button[type="submit"]'],
    successCookie: 'sessionid',
    challengeHints: ['checkpoint', 'two_factor', 'confirmaccountowner', '/accounts/login/two_factor'],
  },
  facebook: {
    loginUrl: 'https://www.facebook.com/login',
    userSelectors: ['input[name="email"]', 'input#email'],
    passSelectors: ['input[name="pass"]', 'input#pass', 'input[type="password"]'],
    submitSelectors: ['button[name="login"]', 'input[type="submit"]', 'button[type="submit"]'],
    successCookie: 'c_user',
    challengeHints: ['/checkpoint', '/two_factor', 'approval_prompt'],
  },
};

const NAV_TIMEOUT_MS = 25_000;

/**
 * Executa o login headless e devolve o storageState serializado.
 * Importa playwright dinamicamente para não pesar no bundle do servidor.
 */
export async function extractSessionByLogin(
  platform: LoginPlatform,
  identifier: string,
  password: string,
): Promise<ManualLoginResult> {
  const spec = SPECS[platform];
  const { chromium } = await import('playwright');
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'pt-BR',
    });
    const page = await context.newPage();
    await page.goto(spec.loginUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });

    const userField = await firstVisible(page, spec.userSelectors);
    if (!userField) return { ok: false, reason: 'login_unreachable', detail: 'campo de usuário não encontrado' };
    await userField.fill(identifier);

    const passField = await firstVisible(page, spec.passSelectors);
    if (!passField) return { ok: false, reason: 'login_unreachable', detail: 'campo de senha não encontrado' };
    await passField.fill(password);

    const submit = await firstVisible(page, spec.submitSelectors);
    if (submit) {
      await submit.click();
    } else {
      await passField.press('Enter');
    }

    // Espera o cookie de sessão aparecer OU um challenge aparecer.
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const url = page.url().toLowerCase();
      if (spec.challengeHints.some((h) => url.includes(h))) {
        return { ok: false, reason: 'needs_2fa', detail: 'a plataforma pediu verificação adicional' };
      }
      const cookies = await context.cookies();
      const session = cookies.find((c) => c.name === spec.successCookie && c.value);
      if (session) {
        const state = await context.storageState();
        return { ok: true, storageState: JSON.stringify(state), sessionCookie: session.value };
      }
      const errText = (await page.textContent('body').catch(() => '')) ?? '';
      if (/usuário incorreto|incorrect|wrong password|senha incorreta/i.test(errText)) {
        return { ok: false, reason: 'bad_credentials', detail: 'credenciais recusadas pela plataforma' };
      }
      await page.waitForTimeout(500);
    }
    return { ok: false, reason: 'timeout', detail: 'sessão não obtida em 20s (provável 2FA ou bloqueio)' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: 'login_unreachable', detail: msg };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

async function firstVisible(page: import('playwright').Page, selectors: string[]) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    try {
      if (await el.isVisible({ timeout: 2_000 })) return el;
    } catch {
      /* próximo seletor */
    }
  }
  return null;
}
