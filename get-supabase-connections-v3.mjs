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
    // First navigate to the project overview to ensure we're logged in and have the right project
    console.log('Navigating to Supabase project overview...');
    // Corrected project ID: ardbabjoepzhkpmkgwgu (not ardpabjoepzhkpmkgwgu)
    await page.goto('https://supabase.com/dashboard/project/ardbabjoepzhkpmkgwgu', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await screenshot('01-project-overview');
    await page.waitForTimeout(3000);

    // Now go to database settings
    console.log('Navigating to Database settings...');
    await page.goto('https://supabase.com/dashboard/project/ardbabjoepzhkpmkgwgu/settings/database', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await screenshot('02-database-settings-loaded');
    await page.waitForTimeout(5000);

    // Get full page content including shadow DOM if any
    const allText = await page.evaluate(() => {
      // Get all text from the page
      return document.body.innerText;
    });

    console.log('Page text length:', allText.length);
    console.log('First 2000 chars:', allText.substring(0, 2000));

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
    const elements = await page.locator('input, textarea, code, pre, [data-testid*="connection"], [class*="connection"]').all();
    console.log(`Found ${elements.length} relevant elements`);

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const tagName = await el.evaluate(e => e.tagName).catch(() => 'unknown');
      const value = await el.inputValue().catch(() => null);
      const text = value || await el.textContent().catch(() => null);
      const className = await el.getAttribute('class').catch(() => '');
      const testId = await el.getAttribute('data-testid').catch(() => '');

      if (text && text.includes('postgresql')) {
        console.log(`Element ${i} (${tagName}): class="${className}" testid="${testId}"`);
        console.log(`  Text: ${text.substring(0, 200)}`);

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

    // Look for tabs or navigation items
    const navItems = await page.locator('nav a, [role="tab"], button[role="tab"], .nav-item, .tab').all();
    console.log(`Found ${navItems.length} nav/tab items`);

    for (let i = 0; i < navItems.length; i++) {
      const item = navItems[i];
      const text = await item.textContent().catch(() => '');
      const href = await item.getAttribute('href').catch(() => '');
      if (text.toLowerCase().includes('connection') || href.includes('connection')) {
        console.log(`Nav item ${i}: "${text}" href="${href}"`);
        await item.click();
        await page.waitForTimeout(2000);
        await screenshot(`03-nav-${i}-${text.replace(/\s+/g, '-')}`);

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
    const poolingTexts = await page.locator('*:has-text("Use connection pooling"), *:has-text("Connection pooling"), *:has-text("connection pooling")').all();
    console.log(`Found ${poolingTexts.length} pooling-related elements`);

    for (let i = 0; i < poolingTexts.length; i++) {
      const el = poolingTexts[i];
      const text = await el.textContent().catch(() => '');
      const tagName = await el.evaluate(e => e.tagName).catch(() => '');
      console.log(`Pooling ${i} (${tagName}): "${text.substring(0, 100)}"`);

      // Check parent for interactive elements
      const parent = el.locator('..');
      const parentHtml = await parent.evaluate(e => e.outerHTML).catch(() => '');
      console.log(`  Parent HTML: ${parentHtml.substring(0, 300)}`);
    }

    // Look for copy buttons near connection strings
    const copyButtons = await page.locator('button:has-text("Copy"), button[aria-label*="copy" i], [data-testid*="copy"]').all();
    console.log(`Found ${copyButtons.length} copy buttons`);

    for (let i = 0; i < copyButtons.length; i++) {
      const btn = copyButtons[i];
      const parent = btn.locator('..');
      const parentText = await parent.textContent().catch(() => '');
      if (parentText.includes('postgresql') || parentText.includes('connection')) {
        console.log(`Copy button ${i} near connection string`);
        await btn.click();
        await page.waitForTimeout(500);
        // Try to read from clipboard
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

    // Check for "Reset database password" - might need to generate password
    const resetButtons = await page.locator('button:has-text("Reset database password"), a:has-text("Reset database password"), *:has-text("Reset password")').all();
    console.log(`Found ${resetButtons.length} reset password elements`);

    for (let i = 0; i < resetButtons.length; i++) {
      const btn = resetButtons[i];
      const text = await btn.textContent().catch(() => '');
      console.log(`Reset ${i}: "${text}"`);
    }

    await screenshot('04-final-check');

    // Final results
    console.log('\n=== RESULTS ===');
    console.log('DATABASE_URL (pooler, port 6543):', databaseUrl || 'NOT FOUND');
    console.log('DIRECT_URL (direct, port 5432):', directUrl || 'NOT FOUND');

    // If we have partial URLs without password, we might need to construct them
    // The format is: postgresql://postgres:[password]@host:port/database?params

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