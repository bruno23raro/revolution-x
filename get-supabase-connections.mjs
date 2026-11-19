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
    await page.waitForTimeout(3000);
    await screenshot('03-database-settings');

    // Find and click on "Connection string" section
    // The page has tabs/sections - look for connection string
    const connectionStringSection = page.locator('text=Connection string').first();
    if (await connectionStringSection.count() > 0) {
      await connectionStringSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
    }

    // Look for the connection string display areas
    // There are typically two: one for pooler (port 6543) and one for direct (port 5432)

    // Try to find the connection strings in the page
    const pageContent = await page.content();

    // Look for connection strings in the page
    const poolerMatch = pageContent.match(/postgresql:\/\/[^"'\s]*:6543[^"'\s]*/);
    const directMatch = pageContent.match(/postgresql:\/\/[^"'\s]*:5432[^"'\s]*/);

    let databaseUrl = poolerMatch ? poolerMatch[0] : null;
    let directUrl = directMatch ? directMatch[0] : null;

    console.log('Found pooler (6543):', databaseUrl);
    console.log('Found direct (5432):', directUrl);

    // If not found in page content, try to find in input fields or copy buttons
    if (!databaseUrl || !directUrl) {
      console.log('Searching for connection strings in UI elements...');

      // Look for input fields with connection strings
      const inputs = await page.locator('input[value*="postgresql://"]').all();
      for (const input of inputs) {
        const value = await input.inputValue();
        if (value.includes(':6543') && !databaseUrl) {
          databaseUrl = value;
          console.log('Found pooler in input:', databaseUrl);
        } else if (value.includes(':5432') && !directUrl) {
          directUrl = value;
          console.log('Found direct in input:', directUrl);
        }
      }

      // Also check text content of elements
      const textElements = await page.locator('*:has-text("postgresql://")').all();
      for (const el of textElements) {
        const text = await el.textContent();
        if (text) {
          const poolerMatch2 = text.match(/postgresql:\/\/[^"'\s]*:6543[^"'\s]*/);
          const directMatch2 = text.match(/postgresql:\/\/[^"'\s]*:5432[^"'\s]*/);
          if (poolerMatch2 && !databaseUrl) databaseUrl = poolerMatch2[0];
          if (directMatch2 && !directUrl) directUrl = directMatch2[0];
        }
      }
    }

    // Check for "Use connection pooling" toggle
    const poolingToggle = page.locator('text=Use connection pooling').first();
    if (await poolingToggle.count() > 0) {
      console.log('Found "Use connection pooling" text');

      // The page might have two sections or a toggle
      // Try to find both connection strings
    }

    await screenshot('04-connection-strings-found');

    // If still not found, try clicking "Reset database password" link
    if (!databaseUrl || !directUrl) {
      const resetPasswordLink = page.locator('text=Reset database password').first();
      if (await resetPasswordLink.count() > 0) {
        console.log('Found "Reset database password" link - may need to generate password');
        await resetPasswordLink.click();
        await page.waitForTimeout(2000);
        await screenshot('05-reset-password-modal');

        // Look for password in modal
        const modalContent = await page.locator('[role="dialog"]').textContent();
        console.log('Modal content:', modalContent);
      }
    }

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