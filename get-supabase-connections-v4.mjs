import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function getSupabaseConnections() {
  const userDataDir = path.join(process.cwd(), 'browser-profile');
  const screenshotsDir = path.join(process.cwd(), 'screenshots');

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    args: ['--start-maximized']
  });

  const page = context.pages()[0] || await context.newPage();

  async function screenshot(name) {
    const file = path.join(screenshotsDir, `${name}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`Screenshot: ${file}`);
    return file;
  }

  try {
    // Use the exact project ID from user's URL: ardpabjoepzhkpmkgwgu
    console.log('Navigating to Supabase project overview...');
    await page.goto('https://supabase.com/dashboard/project/ardpabjoepzhkpmkgwgu', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await screenshot('01-project-overview');
    await page.waitForTimeout(3000);

    // Now go to database settings
    console.log('Navigating to Database settings...');
    await page.goto('https://supabase.com/dashboard/project/ardpabjoepzhkpmkgwgu/settings/database', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await screenshot('02-database-settings-loaded');
    await page.waitForTimeout(5000);

    // Get full page content
    const allText = await page.evaluate(() => {
      return document.body.innerText;
    });

    console.log('Page text length:', allText.length);
    console.log('First 3000 chars:', allText.substring(0, 3000));

    // Search for connection strings
    const patterns = [
      /postgresql:\/\/[^\s"']*:6543[^\s"']*/g,
      /postgresql:\/\/[^\s"']*:5432[^\s"']*/g,
      /postgres:\/\/[^\s"']*:6543[^\s"']*/g,
      /postgres:\/\/[^\s"']*:5432[^\s"']*/g,
    ];

    let databaseUrl = null;
    let directUrl = null;

    for (const pattern of patterns) {
      const matches = allText.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (match.includes(':6543') && !databaseUrl) {
            databaseUrl = match;
          } else if (match.includes(':5432') && !directUrl) {
            directUrl = match;
          }
        }
      }
    }

    console.log('Found pooler (6543):', databaseUrl);
    console.log('Found direct (5432):', directUrl);

    // Check all input fields, textareas, code blocks, pre tags
    const elements = await page.locator('input, textarea, code, pre').all();
    console.log(`Found ${elements.length} input/code/pre elements`);

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const tagName = await el.evaluate(e => e.tagName).catch(() => 'unknown');
      const value = await el.inputValue().catch(() => null);
      const text = value || await el.textContent().catch(() => null);
      const className = await el.getAttribute('class').catch(() => '');
      const testId = await el.getAttribute('data-testid').catch(() => '');

      if (text && (text.includes('postgresql') || text.includes('postgres') || text.includes('connection'))) {
        console.log(`Element ${i} (${tagName}): class="${className}" testid="${testId}"`);
        console.log(`  Text: ${text.substring(0, 500)}`);

        if (text.includes(':6543') && !databaseUrl) {
          const match = text.match(/postgresql:\/\/[^\s"']*:6543[^\s"']*/);
          if (match) databaseUrl = match[0];
        }
        if (text.includes(':5432') && !directUrl) {
          const match = text.match(/postgresql:\/\/[^\s"']*:5432[^\s"']*/);
          if (match) directUrl = match[0];
        }
      }
    }

    // Look for specific connection string containers
    const connectionContainers = await page.locator('[class*="connection"], [data-testid*="connection"], [id*="connection"]').all();
    console.log(`Found ${connectionContainers.length} connection-related containers`);

    for (let i = 0; i < connectionContainers.length; i++) {
      const el = connectionContainers[i];
      const text = await el.textContent().catch(() => '');
      const html = await el.evaluate(e => e.outerHTML).catch(() => '');
      console.log(`Container ${i}:`);
      console.log(`  Text: ${text.substring(0, 500)}`);
      console.log(`  HTML: ${html.substring(0, 500)}`);
    }

    // Look for tabs or navigation items
    const navItems = await page.locator('nav a, [role="tab"], button[role="tab"], .nav-item, .tab, button').all();
    console.log(`Found ${navItems.length} nav/tab/button items`);

    for (let i = 0; i < Math.min(navItems.length, 50); i++) {
      const item = navItems[i];
      const text = await item.textContent().catch(() => '');
      const href = await item.getAttribute('href').catch(() => '');
      const className = await item.getAttribute('class').catch(() => '');
      if (text.toLowerCase().includes('connection') || href.includes('connection') || className.includes('connection')) {
        console.log(`Nav item ${i}: "${text}" href="${href}" class="${className}"`);
        await item.click();
        await page.waitForTimeout(2000);
        await screenshot(`03-nav-${i}-${text.replace(/\s+/g, '-').substring(0, 30)}`);

        // Re-check
        const newText = await page.evaluate(() => document.body.innerText);
        for (const pattern of patterns) {
          const matches = newText.match(pattern);
          if (matches) {
            for (const match of matches) {
              if (match.includes(':6543') && !databaseUrl) databaseUrl = match;
              if (match.includes(':5432') && !directUrl) directUrl = match;
            }
          }
        }
      }
    }

    // Check for "Use connection pooling" - might be a toggle/switch
    const poolingElements = await page.locator('*:has-text("Use connection pooling"), *:has-text("Connection pooling"), *:has-text("connection pooling")').all();
    console.log(`Found ${poolingElements.length} pooling-related elements`);

    for (let i = 0; i < poolingElements.length; i++) {
      const el = poolingElements[i];
      const text = await el.textContent().catch(() => '');
      const tagName = await el.evaluate(e => e.tagName).catch(() => '');
      console.log(`Pooling ${i} (${tagName}): "${text.substring(0, 200)}"`);

      // Check parent for interactive elements
      const parent = el.locator('..');
      const parentHtml = await parent.evaluate(e => e.outerHTML).catch(() => '');
      console.log(`  Parent HTML: ${parentHtml.substring(0, 500)}`);
    }

    // Look for radio buttons or switches
    const radios = await page.locator('input[type="radio"], input[type="checkbox"], [role="switch"], [role="radio"]').all();
    console.log(`Found ${radios.length} radio/checkbox/switch elements`);

    for (let i = 0; i < radios.length; i++) {
      const radio = radios[i];
      const id = await radio.getAttribute('id').catch(() => null);
      const name = await radio.getAttribute('name').catch(() => null);
      const value = await radio.getAttribute('value').catch(() => null);
      const checked = await radio.isChecked().catch(() => false);
      const role = await radio.getAttribute('role').catch(() => null);
      const ariaLabel = await radio.getAttribute('aria-label').catch(() => null);
      const label = id ? await page.locator(`label[for="${id}"]`).textContent().catch(() => null) : null;
      const parentText = await radio.locator('..').textContent().catch(() => '');
      console.log(`Radio ${i}: id=${id}, name=${name}, value=${value}, checked=${checked}, role=${role}, aria-label=${ariaLabel}, label=${label}, parent="${parentText.substring(0, 100)}"`);
    }

    // Try clicking on radios that might control pooling
    for (let i = 0; i < radios.length; i++) {
      const radio = radios[i];
      const parentText = await radio.locator('..').textContent().catch(() => '');
      const label = await radio.getAttribute('aria-label').catch(() => '');
      const combined = (parentText + ' ' + label).toLowerCase();

      if (combined.includes('pool') || combined.includes('direct') || combined.includes('session') || combined.includes('transaction')) {
        console.log(`Clicking radio ${i} (${combined.substring(0, 100)})...`);
        await radio.click();
        await page.waitForTimeout(2000);
        await screenshot(`04-radio-${i}-clicked`);

        // Re-check for connection strings
        const newText = await page.evaluate(() => document.body.innerText);
        for (const pattern of patterns) {
          const matches = newText.match(pattern);
          if (matches) {
            for (const match of matches) {
              if (match.includes(':6543') && !databaseUrl) databaseUrl = match;
              if (match.includes(':5432') && !directUrl) directUrl = match;
            }
          }
        }
      }
    }

    // Check for copy buttons
    const copyButtons = await page.locator('button:has-text("Copy"), button[aria-label*="copy" i], [data-testid*="copy"]').all();
    console.log(`Found ${copyButtons.length} copy buttons`);

    for (let i = 0; i < copyButtons.length; i++) {
      const btn = copyButtons[i];
      const parent = btn.locator('..');
      const parentText = await parent.textContent().catch(() => '');
      const parentHtml = await parent.evaluate(e => e.outerHTML).catch(() => '');
      if (parentText.includes('postgresql') || parentText.includes('postgres') || parentText.includes('connection')) {
        console.log(`Copy button ${i} near connection string`);
        console.log(`  Parent text: ${parentText.substring(0, 200)}`);
        await btn.click();
        await page.waitForTimeout(500);
        const clipboard = await page.evaluate(async () => {
          try {
            return await navigator.clipboard.readText();
          } catch { return null; }
        });
        console.log(`  Clipboard: ${clipboard}`);
        if (clipboard && clipboard.includes('postgresql')) {
          if (clipboard.includes(':6543') && !databaseUrl) databaseUrl = clipboard;
          if (clipboard.includes(':5432') && !directUrl) directUrl = clipboard;
        }
      }
    }

    // Check for "Reset database password"
    const resetElements = await page.locator('*:has-text("Reset database password"), *:has-text("Reset password")').all();
    console.log(`Found ${resetElements.length} reset password elements`);

    for (let i = 0; i < resetElements.length; i++) {
      const el = resetElements[i];
      const text = await el.textContent().catch(() => '');
      const tagName = await el.evaluate(e => e.tagName).catch(() => '');
      console.log(`Reset ${i} (${tagName}): "${text.substring(0, 100)}"`);
    }

    await screenshot('05-final-check');

    // Final results
    console.log('\n=== RESULTS ===');
    console.log('DATABASE_URL (pooler, port 6543):', databaseUrl || 'NOT FOUND');
    console.log('DIRECT_URL (direct, port 5432):', directUrl || 'NOT FOUND');

    // Save to file
    const result = {
      DATABASE_URL: databaseUrl,
      DIRECT_URL: directUrl,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(process.cwd(), 'supabase-connections.json'),
      JSON.stringify(result, null, 2)
    );

    return result;

  } catch (error) {
    console.error('Error:', error);
    await screenshot('error');
    throw error;
  } finally {
    await context.close();
  }
}

getSupabaseConnections()
  .then(result => {
    console.log('\nDone. Results saved to supabase-connections.json');
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });