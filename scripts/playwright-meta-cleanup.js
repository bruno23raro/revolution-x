const { chromium } = require('playwright');

const SCOPES_TO_REMOVE = [
  'ads_management',
  'catalog_management',
  'instagram_branded_content_ads_brand',
  'facebook_branded_content_ads_brand',
  'pages_manage_metadata',
  'ads_mcp_management',
  'pages_messaging',
  'whatsapp_business_manage_events'
];

const APP_URL = 'https://developers.facebook.com/apps/1112157761403064/use-cases/';
const PERMISSIONS_URL = 'https://developers.facebook.com/apps/1112157761403064/permissions/';
const ARTIFACTS_DIR = 'artifacts/RX_META_APP_REVIEW';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name) {
  const path = `${ARTIFACTS_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`📸 Screenshot saved: ${path}`);
  return path;
}

async function waitForSelectorWithFallbacks(page, selectors, timeout = 10000) {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout, state: 'visible' });
      return selector;
    } catch (e) {
      console.log(`  Selector failed: ${selector}`);
    }
  }
  throw new Error(`None of the selectors matched: ${selectors.join(', ')}`);
}

async function clickWithFallbacks(page, selectors, timeout = 10000) {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout, state: 'visible' });
      await page.click(selector);
      return selector;
    } catch (e) {
      console.log(`  Click failed: ${selector}`);
    }
  }
  throw new Error(`Could not click any of: ${selectors.join(', ')}`);
}

async function removeScope(page, scopeName) {
  console.log(`\n🔧 Removing scope: ${scopeName}`);

  const rowSelectors = [
    `tr:has-text("${scopeName}")`,
    `td:has-text("${scopeName}")`,
    `[data-testid*="${scopeName}"]`,
    `div[role="row"]:has-text("${scopeName}")`,
    `tbody tr:has-text("${scopeName}")`,
  ];

  let rowFound = false;
  let matchedSelector = null;

  for (const selector of rowSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 3000, state: 'visible' });
      rowFound = true;
      matchedSelector = selector;
      break;
    } catch (e) {
      // continue
    }
  }

  if (!rowFound) {
    console.log(`  ⚠️  Scope row not found for: ${scopeName} (may already be removed)`);
    return false;
  }

  console.log(`  Found row with: ${matchedSelector}`);

  const actionsMenuSelectors = [
    `${matchedSelector} >> [aria-label="Actions"]`,
    `${matchedSelector} >> button:has-text("Actions")`,
    `${matchedSelector} >> [role="menu"] button`,
    `${matchedSelector} >> button[aria-haspopup="menu"]`,
    `${matchedSelector} >> .x1n2onr6 button`, // FB specific class pattern
    `${matchedSelector} >> button:has(svg[data-icon="chevron-down"])`,
  ];

  let actionsClicked = false;
  for (const selector of actionsMenuSelectors) {
    try {
      await page.click(selector);
      console.log(`  Clicked Actions menu with: ${selector}`);
      actionsClicked = true;
      await sleep(500);
      break;
    } catch (e) {
      console.log(`  Actions click failed: ${selector}`);
    }
  }

  if (!actionsClicked) {
    console.log(`  ❌ Could not open Actions menu for ${scopeName}`);
    return false;
  }

  const removeSelectors = [
    '[role="menuitem"]:has-text("Remove")',
    '[role="menuitem"]:has-text("Eliminar")',
    'div[role="menu"] >> text=Remove',
    'div[role="menu"] >> text=Eliminar',
    'button:has-text("Remove")',
    'a:has-text("Remove")',
  ];

  let removeClicked = false;
  for (const selector of removeSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 3000, state: 'visible' });
      await page.click(selector);
      console.log(`  Clicked Remove with: ${selector}`);
      removeClicked = true;
      await sleep(500);
      break;
    } catch (e) {
      console.log(`  Remove click failed: ${selector}`);
    }
  }

  if (!removeClicked) {
    console.log(`  ❌ Could not click Remove for ${scopeName}`);
    await page.keyboard.press('Escape');
    return false;
  }

  const confirmSelectors = [
    'button:has-text("Confirm")',
    'button:has-text("Confirmar")',
    'button:has-text("Remove")',
    'button:has-text("Eliminar")',
    '[data-testid="confirm-button"]',
    'div[role="dialog"] >> button:has-text("Confirm")',
    'div[role="dialog"] >> button:has-text("Confirmar")',
    'div[role="dialog"] >> button:has-text("Remove")',
    'div[role="dialog"] >> button:has-text("Eliminar")',
    'button[type="submit"]',
  ];

  let confirmed = false;
  for (const selector of confirmSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
      await page.click(selector);
      console.log(`  Confirmed removal with: ${selector}`);
      confirmed = true;
      await sleep(1000);
      break;
    } catch (e) {
      console.log(`  Confirm click failed: ${selector}`);
    }
  }

  if (!confirmed) {
    console.log(`  ❌ Could not confirm removal for ${scopeName}`);
    await page.keyboard.press('Escape');
    return false;
  }

  console.log(`  ✅ Successfully removed: ${scopeName}`);
  return true;
}

async function navigateToPermissions(page) {
  console.log('\n📍 Navigating to Permissions page...');
  await page.goto(PERMISSIONS_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(3000);
  await takeScreenshot(page, 'permissions-page-loaded');
}

async function main() {
  console.log('🚀 Starting Meta App Scope Cleanup');
  console.log('=====================================');
  console.log(`Target App: 1112157761403064`);
  console.log(`Scopes to remove: ${SCOPES_TO_REMOVE.length}`);
  SCOPES_TO_REMOVE.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

  const browser = await chromium.launch({
    headless: false,
    channel: 'chromium',
    args: ['--start-maximized'],
    slowMo: 100,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: ARTIFACTS_DIR, size: { width: 1920, height: 1080 } },
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [Browser Console Error]: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`  [Page Error]: ${err.message}`);
  });

  try {
    console.log('\n🌐 Navigating to Meta App Use Cases page...');
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await sleep(2000);

    console.log('\n⏸️  ===========================================');
    console.log('   MANUAL LOGIN REQUIRED');
    console.log('   Please log in to Meta Developers console');
    console.log('   Press ENTER in terminal when done...');
    console.log('===========================================\n');

    // Wait for user to press Enter
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });

    console.log('✅ Resuming after manual login...');
    await sleep(2000);
    await takeScreenshot(page, 'after-login');

    await navigateToPermissions(page);

    console.log('\n🔍 Checking current permissions...');
    await sleep(2000);

    const results = { removed: [], failed: [], notFound: [] };

    for (const scope of SCOPES_TO_REMOVE) {
      const success = await removeScope(page, scope);
      if (success) {
        results.removed.push(scope);
      } else {
        results.failed.push(scope);
      }
      await sleep(1500);
    }

    console.log('\n📸 Taking final screenshot...');
    await takeScreenshot(page, 'scope-cleanup-final');

    console.log('\n=====================================');
    console.log('📊 CLEANUP SUMMARY');
    console.log('=====================================');
    console.log(`✅ Removed: ${results.removed.length}`);
    results.removed.forEach(s => console.log(`   - ${s}`));
    console.log(`❌ Failed: ${results.failed.length}`);
    results.failed.forEach(s => console.log(`   - ${s}`));
    console.log(`⚠️  Not found: ${results.notFound.length}`);
    results.notFound.forEach(s => console.log(`   - ${s}`));

    if (results.failed.length > 0) {
      console.log('\n⚠️  Some scopes failed to remove. Manual review needed.');
      process.exit(1);
    }

    console.log('\n✅ All scopes removed successfully!');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    await takeScreenshot(page, 'error-state');
    process.exit(1);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});