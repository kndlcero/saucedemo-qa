/**
 * Exploratory probe: runs the same shopper journey as every demo user and
 * dumps raw observations (timings, DOM state, console errors, screenshots)
 * to explore-output/. The output was read by an AI assistant (Claude Code) to
 * spot anomalies, which were then turned into deterministic Playwright tests.
 *
 * Run: npx tsx scripts/explore.ts
 */
import { chromium, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE = 'https://www.saucedemo.com';
const PASSWORD = 'secret_sauce'; // public demo password printed on the login page
const USERS = process.env.USERS ? process.env.USERS.split(',') : ['standard_user', 'locked_out_user', 'problem_user', 'performance_glitch_user', 'error_user', 'visual_user'];
const OUT = path.join(process.cwd(), 'explore-output');

async function snap(page: Page, user: string, name: string) {
  await page.screenshot({ path: path.join(OUT, user, `${name}.png`), fullPage: true });
}

async function probe(user: string) {
  fs.mkdirSync(path.join(OUT, user), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const log: Record<string, unknown> = { user };
  const consoleErrors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
  page.on('dialog', async d => { consoleErrors.push('dialog: ' + d.message()); await d.dismiss(); });

  try {
    await page.goto(BASE);
    await page.fill('#user-name', user);
    await page.fill('#password', PASSWORD);
    const t0 = Date.now();
    await page.click('#login-button');
    await Promise.race([
      page.waitForURL('**/inventory.html', { timeout: 15000 }),
      page.waitForSelector('[data-test="error"]', { timeout: 15000 }),
    ]);
    log.loginMs = Date.now() - t0;
    log.urlAfterLogin = page.url();
    if (!page.url().includes('inventory')) {
      log.loginError = await page.textContent('[data-test="error"]');
      await snap(page, user, '01-login-error');
      return log;
    }
    await snap(page, user, '01-inventory');

    log.items = await page.$$eval('.inventory_item', els => els.map(el => ({
      name: el.querySelector('.inventory_item_name')?.textContent,
      desc: el.querySelector('.inventory_item_desc')?.textContent,
      price: el.querySelector('.inventory_item_price')?.textContent,
      img: el.querySelector('img')?.getAttribute('src'),
      button: el.querySelector('button')?.textContent,
      btnBox: (() => { const b = el.querySelector('button')!.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y)]; })(),
    })));

    // sorting
    const sorts: Record<string, unknown> = {};
    for (const opt of ['za', 'lohi', 'hilo', 'az']) {
      const ts = Date.now();
      await page.selectOption('[data-test="product-sort-container"]', opt);
      await page.waitForTimeout(300);
      sorts[opt] = { ms: Date.now() - ts, names: await page.$$eval('.inventory_item_name', e => e.map(x => x.textContent)), prices: await page.$$eval('.inventory_item_price', e => e.map(x => x.textContent)) };
    }
    log.sorts = sorts;

    // add all to cart one by one, record badge + button text
    const adds: unknown[] = [];
    const btns = await page.$$('.inventory_item button');
    for (let i = 0; i < btns.length; i++) {
      const b = (await page.$$('.inventory_item button'))[i];
      await b.click();
      await page.waitForTimeout(100);
      adds.push({ i, btn: await b.textContent(), badge: await page.textContent('.shopping_cart_badge').catch(() => null) });
    }
    log.adds = adds;
    await snap(page, user, '02-all-added');

    // try removing first 2 from inventory page
    const removes: unknown[] = [];
    for (let i = 0; i < 2; i++) {
      const b = (await page.$$('.inventory_item button'))[i];
      await b.click();
      await page.waitForTimeout(100);
      removes.push({ i, btn: await b.textContent(), badge: await page.textContent('.shopping_cart_badge').catch(() => null) });
    }
    log.removes = removes;

    // product details page of first item
    await page.click('.inventory_item_name >> nth=0');
    await page.waitForLoadState();
    log.detailUrl = page.url();
    log.detail = { name: await page.textContent('.inventory_details_name').catch(() => null), price: await page.textContent('.inventory_details_price').catch(() => null) };
    await snap(page, user, '03-detail');
    await page.goto(BASE + '/inventory.html');

    // cart
    await page.click('.shopping_cart_link');
    log.cart = await page.$$eval('.cart_item', els => els.map(el => ({ name: el.querySelector('.inventory_item_name')?.textContent, price: el.querySelector('.inventory_item_price')?.textContent, qty: el.querySelector('.cart_quantity')?.textContent })));
    await snap(page, user, '04-cart');

    // checkout
    await page.click('[data-test="checkout"]');
    await page.fill('[data-test="firstName"]', 'Ada');
    await page.fill('[data-test="lastName"]', 'Lovelace');
    await page.fill('[data-test="postalCode"]', '12345');
    log.formValues = { first: await page.inputValue('[data-test="firstName"]'), last: await page.inputValue('[data-test="lastName"]'), zip: await page.inputValue('[data-test="postalCode"]') };
    await snap(page, user, '05-checkout-info');
    await page.click('[data-test="continue"]');
    await page.waitForTimeout(500);
    log.urlAfterContinue = page.url();
    log.checkoutError = await page.textContent('[data-test="error"]').catch(() => null);
    if (page.url().includes('step-two')) {
      log.summary = {
        items: await page.$$eval('.cart_item', els => els.map(el => el.querySelector('.inventory_item_price')?.textContent)),
        subtotal: await page.textContent('.summary_subtotal_label'),
        tax: await page.textContent('.summary_tax_label'),
        total: await page.textContent('.summary_total_label'),
      };
      await snap(page, user, '06-overview');
      await page.click('[data-test="finish"]');
      await page.waitForTimeout(500);
      log.urlAfterFinish = page.url();
      await snap(page, user, '07-complete');
    }
  } catch (e) {
    log.exception = String(e).slice(0, 500);
    await snap(page, user, '99-exception').catch(() => {});
  } finally {
    log.consoleErrors = consoleErrors;
    await browser.close();
  }
  return log;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  for (const u of USERS) { console.log('probing', u); results.push(await probe(u)); }
  fs.writeFileSync(path.join(OUT, 'observations.json'), JSON.stringify(results, null, 2));
  console.log('done ->', path.join(OUT, 'observations.json'));
})();
