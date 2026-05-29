/**
 * Playwright smoke test — read-only walkthrough of every DayLog page.
 * Run: npx playwright install chromium && node smoke-test.mjs
 * Requires: npm run dev (client on 5173, server on 3001)
 */

import { chromium } from 'playwright';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const BASE = 'http://localhost:5173';
const screenshotDir = mkdtempSync(join(tmpdir(), 'daylog-smoke-'));
let screenshotIndex = 0;

async function screenshot(page, name) {
  const file = join(screenshotDir, `${String(++screenshotIndex).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  Screenshot: ${file}`);
}

async function smokeTest() {
  console.log(`Screenshots will be saved to: ${screenshotDir}\n`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // --- Today Page ---
  console.log('1. Today Page (/)');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const clockedIn = await page.$('text=Clock Out');
  console.log(`   Status: ${clockedIn ? 'Clocked In' : 'Clocked Out'}`);
  const noteCount = await page.$$eval('[class*="note"]', els => els.length).catch(() => 0);
  console.log(`   Notes visible: ${noteCount}`);
  await screenshot(page, 'today');

  // --- History Page ---
  console.log('\n2. History Page (/history)');
  await page.click('a[href="/history"]');
  await page.waitForLoadState('networkidle');
  const sessionCards = await page.$$('[class*="session"], [class*="card"]');
  console.log(`   Session cards: ${sessionCards.length}`);
  await screenshot(page, 'history');

  // --- Test Runs Page ---
  console.log('\n3. Test Runs Page (/test-runs)');
  await page.click('a[href="/test-runs"]');
  await page.waitForLoadState('networkidle');
  await screenshot(page, 'test-runs-default');

  // Try clicking server tabs if they exist
  const tabs = await page.$$('[class*="tab"], [role="tab"]');
  console.log(`   Tabs found: ${tabs.length}`);
  for (const tab of tabs) {
    const text = await tab.textContent();
    console.log(`   - Tab: ${text?.trim()}`);
  }
  if (tabs.length > 1) {
    await tabs[1].click();
    await page.waitForTimeout(500);
    await screenshot(page, 'test-runs-tab2');
  }

  // --- Portfolio Page ---
  console.log('\n4. Portfolio Page (/portfolio)');
  await page.click('a[href="/portfolio"]');
  await page.waitForLoadState('networkidle');

  // Read stats
  const stats = await page.$$eval('[class*="stat"]', els =>
    els.map(el => el.textContent?.trim()).filter(Boolean)
  ).catch(() => []);
  if (stats.length) {
    console.log(`   Stats: ${stats.join(' | ')}`);
  }
  await screenshot(page, 'portfolio-sessions');

  // Click Bugs tab if present
  const bugsTab = await page.$('text=Bugs');
  if (bugsTab) {
    await bugsTab.click();
    await page.waitForTimeout(500);
    await screenshot(page, 'portfolio-bugs');
  }

  // --- Invoices Page ---
  console.log('\n5. Invoices Page (/invoices)');
  await page.click('a[href="/invoices"]');
  await page.waitForLoadState('networkidle');
  await screenshot(page, 'invoices-top');

  // Scroll to see all sections
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
  await page.waitForTimeout(300);
  await screenshot(page, 'invoices-middle');

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await screenshot(page, 'invoices-bottom');

  // Count sections
  const headings = await page.$$eval('h2, h3', els =>
    els.map(el => el.textContent?.trim()).filter(Boolean)
  );
  console.log(`   Sections: ${headings.join(', ')}`);

  // Done
  await browser.close();
  console.log(`\nSmoke test complete. ${screenshotIndex} screenshots saved to:\n  ${screenshotDir}`);
}

smokeTest().catch(err => {
  console.error('Smoke test failed:', err.message);
  process.exit(1);
});
