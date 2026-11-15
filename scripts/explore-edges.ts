/**
 * Second exploratory pass: edge cases a real shopper (or attacker) would hit.
 * Run: npx tsx scripts/explore-edges.ts
 */
import { chromium, Page } from '@playwright/test';
import fs from 'fs';

const BASE = 'https://www.saucedemo.com';
const OUT = 'explore-output/edges';

async function login(page: Page, user = 'standard_user') {
  await page.goto(BASE);
  await page.fill('#user-name', user);
  await page.fill('#password', 'secret_sauce');
  await page.click('#login-button');
  await page.waitForSelector('.inventory_list', { timeout: 20000 });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const r: Record<string, unknown> = {};
  let page = await b.newPage();

  // 1. deep link without login
  await page.goto(BASE + '/inventory.html');
  r.deepLinkNoAuth = { url: page.url(), err: await page.textContent('[data-test="error"]').catch(() => null) };
  await page.screenshot({ path: `${OUT}/deeplink.png` });

  // 2. wrong password + empty fields messages
  await page.goto(BASE);
  await page.click('#login-button');
  r.emptyLogin = await page.textContent('[data-test="error"]');
  await page.fill('#user-name', 'standard_user');
  await page.fill('#password', 'nope');
  await page.click('#login-button');
  r.badPassword = await page.textContent('[data-test="error"]');
  await page.screenshot({ path: `${OUT}/bad-password.png` });

  // 3. empty cart checkout
  await login(page);
  await page.click('.shopping_cart_link');
  await page.screenshot({ path: `${OUT}/empty-cart.png` });
  r.checkoutBtnEnabledOnEmpty = await page.isEnabled('[data-test="checkout"]');
  await page.click('[data-test="checkout"]');
  await page.fill('[data-test="firstName"]', '   ');
  await page.fill('[data-test="lastName"]', '!!!');
  await page.fill('[data-test="postalCode"]', 'abcde');
  await page.click('[data-test="continue"]');
  r.emptyCartJunkInfo = { url: page.url(), err: await page.textContent('[data-test="error"]').catch(() => null) };
  if (page.url().includes('step-two')) {
    r.emptyOverview = { total: await page.textContent('.summary_total_label'), tax: await page.textContent('.summary_tax_label') };
    await page.screenshot({ path: `${OUT}/empty-order-overview.png`, fullPage: true });
    await page.click('[data-test="finish"]');
    r.emptyOrderFinishUrl = page.url();
    await page.screenshot({ path: `${OUT}/empty-order-complete.png`, fullPage: true });
  }

  // 4. checkout form validation messages
  await page.goto(BASE + '/checkout-step-one.html');
  await page.click('[data-test="continue"]');
  r.formEmptyErr = await page.textContent('[data-test="error"]');
  await page.screenshot({ path: `${OUT}/form-error.png` });

  // 5. reset app state while items in cart
  await page.goto(BASE + '/inventory.html');
  await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
  await page.click('[data-test="add-to-cart-sauce-labs-bike-light"]');
  await page.click('#react-burger-menu-btn');
  await page.click('#reset_sidebar_link');
  await page.click('#react-burger-cross-btn');
  await page.waitForTimeout(300);
  r.afterReset = {
    badge: await page.textContent('.shopping_cart_badge').catch(() => null),
    backpackBtn: await page.textContent('[data-test^="remove-sauce-labs-backpack"], [data-test^="add-to-cart-sauce-labs-backpack"]'),
  };
  await page.screenshot({ path: `${OUT}/after-reset.png` });
  await page.reload();
  r.afterResetReload = { backpackBtn: await page.textContent('#inventory_container button >> nth=0') };

  // 6. cart persistence across logout/login
  await page.click('[data-test="add-to-cart-sauce-labs-onesie"]');
  await page.click('#react-burger-menu-btn');
  await page.click('#logout_sidebar_link');
  r.urlAfterLogout = page.url();
  await page.goBack();
  r.backAfterLogout = { url: page.url(), err: await page.textContent('[data-test="error"]').catch(() => null) };
  await login(page);
  r.cartBadgeAfterRelogin = await page.textContent('.shopping_cart_badge').catch(() => null);

  // 7. storage
  r.cookies = (await page.context().cookies()).map(c => `${c.name}=${c.value}; expires=${c.expires}`);
  r.localStorage = await page.evaluate(() => JSON.stringify(localStorage));

  // 8. About link
  await page.click('#react-burger-menu-btn');
  r.aboutHref = await page.getAttribute('#about_sidebar_link', 'href');

  // 9. accessibility smells
  r.a11y = await page.evaluate(() => ({
    imgsNoAlt: [...document.querySelectorAll('img')].filter(i => !i.alt).length,
    productNameIsLink: !!document.querySelector('.inventory_item_name')?.closest('a'),
    sortHasLabel: !!document.querySelector('select')?.getAttribute('aria-label') || !!document.querySelector('label[for]'),
    cartLinkLabel: document.querySelector('.shopping_cart_link')?.getAttribute('aria-label') ?? document.querySelector('.shopping_cart_link')?.textContent,
    htmlLang: document.documentElement.lang,
  }));

  // 10. mobile viewport
  const m = await b.newPage({ viewport: { width: 375, height: 812 } });
  await login(m);
  await m.screenshot({ path: `${OUT}/mobile-inventory.png`, fullPage: false });
  await m.click('[data-test="add-to-cart-sauce-labs-backpack"]');
  await m.click('.shopping_cart_link');
  await m.screenshot({ path: `${OUT}/mobile-cart.png` });

  // 11. performance_glitch real time-to-inventory
  const p = await b.newPage();
  await p.goto(BASE);
  await p.fill('#user-name', 'performance_glitch_user');
  await p.fill('#password', 'secret_sauce');
  const t = Date.now();
  await p.click('#login-button');
  await p.waitForSelector('.inventory_list', { timeout: 30000 });
  r.perfGlitchLoginMs = Date.now() - t;

  // 12. which resource 404s for standard user
  const s = await b.newPage();
  const failed: string[] = [];
  s.on('response', res => { if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`); });
  await login(s);
  await s.waitForTimeout(1000);
  r.failedRequests = failed;

  fs.writeFileSync(`${OUT}/edges.json`, JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
