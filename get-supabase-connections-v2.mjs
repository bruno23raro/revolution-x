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
    // Navigate to Supabase dashboard
    console.log('Navigating to Supabase dashboard...');
    await page.goto('https://supabase.com/dashboard/project/ardpabjoepzhkpmkgwgu/settings/database', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await screenshot('01-dashboard-loaded');

    // Check if we need to log in
    if (page.url().includes('login') || page.url().includes('auth')) {
      console.log('Login required. Please log in manually in the browser window.');
      console.log('Waiting for login to complete...');

      // Wait for navigation away from login page
      await page.waitForURL('**/dashboard/**', { timeout: 120000 });
      await screenshot('02-after-login');
    }

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    await screenshot('03-database-settings');

    // Look for the connection string section - might be in tabs or accordions
    // Let's search more broadly
    const allText = await page.evaluate(() => document.body.innerText);
    console.log('Page text length:', allText.length);

    // Search for connection strings with various patterns
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

    // Also check for any input fields or code blocks
    const inputs = await page.locator('input, textarea, code, pre').all();
    for (const input of inputs) {
      const value = await input.inputValue().catch(() => null);
      const text = value || await input.textContent().catch(() => null);
      if (text && text.includes('postgresql://')) {
        console.log('Found in element:', text.substring(0, 100));
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

    // Check for tabs - "Connection string" might be a tab
    const tabs = page.locator('[role="tab"], button:has-text("Connection"), a:has-text("Connection")');
    const tabCount = await tabs.count();
    console.log('Tab count:', tabCount);

    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const text = await tab.textContent();
      console.log(`Tab ${i}:`, text);
      if (text && text.toLowerCase().includes('connection')) {
        await tab.click();
        await page.waitForTimeout(2000);
        await screenshot(`04-tab-${i}-connection`);

        // Re-check after clicking tab
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

    // Check for "Use connection pooling" toggle/radio
    const poolingElements = page.locator('*:has-text("Use connection pooling"), *:has-text("Connection pooling")');
    const poolingCount = await poolingElements.count();
    console.log('Pooling elements:', poolingCount);

    for (let i = 0; i < poolingCount; i++) {
      const el = poolingElements.nth(i);
      const text = await el.textContent();
      console.log(`Pooling ${i}:`, text);
      // Check if it's a toggle/radio we can click
      const tagName = await el.evaluate(e => e.tagName);
      const type = await el.getAttribute('type').catch(() => null);
      console.log(`  tagName: ${tagName}, type: ${type}`);
    }

    // Look for radio buttons or checkboxes for pooling
    const radios = page.locator('input[type="radio"], input[type="checkbox"]');
    const radioCount = await radios.count();
    console.log('Radio/checkbox count:', radioCount);

    for (let i = 0; i < radioCount; i++) {
      const radio = radios.nth(i);
      const id = await radio.getAttribute('id').catch(() => null);
      const name = await radio.getAttribute('name').catch(() => null);
      const value = await radio.getAttribute('value').catch(() => null);
      const checked = await radio.isChecked().catch(() => false);
      const label = await page.locator(`label[for="${id}"]`).textContent().catch(() => null);
      console.log(`Radio ${i}: id=${id}, name=${name}, value=${value}, checked=${checked}, label=${label}`);
    }

    // Try clicking on any radio that might control pooling
    if (radioCount > 0) {
      // Check for labels containing "pooling" or "direct"
      for (let i = 0; i < radioCount; i++) {
        const radio = radios.nth(i);
        const label = await page.locator(`label[for="${await radio.getAttribute('id').catch(() => '')}"]`).textContent().catch(() => '');
        const parentText = await radio.locator('..').textContent().catch(() => '');
        const combined = (label + ' ' + parentText).toLowerCase();
        console.log(`Radio ${i} context:`, combined);

        if (combined.includes('pooling') || combined.includes('direct') || combined.includes('session')) {
          console.log(`Clicking radio ${i}...`);
          await radio.click();
          await page.waitForTimeout(2000);
          await screenshot(`05-radio-${i}-clicked`);

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
    }

    // Check for "Reset database password"
    const resetPassword = page.locator('text=Reset database password, button:has-text("Reset"), a:has-text("Reset")');
    if (await resetPassword.count() > 0) {
      console.log('Found reset password option');
      // Check if password is missing from connection strings
      if (!databaseUrl || !directUrl) {
        console.log('Password may be missing, but skipping reset for safety');
      }
    }

    await screenshot('06-final-state');

    // Final results
    console.log('\n=== RESULTS ===');
    console.log('DATABASE_URL (pooler, port 6543):', databaseUrl || 'NOT FOUND');
    console.log('DIRECT_URL (direct, port 5432):', directUrl || 'NOT FOUND');

    // If we have partial URLs without password, we might need to construct them
    if (databaseUrl && !databaseUrl.includes(':')) {
      // URL might be missing password
    }

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