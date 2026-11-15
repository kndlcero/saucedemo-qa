/**
 * Captures the annotated screenshots used in the UX review (docs/ux/*.png).
 * Problem areas are outlined in magenta so they read at a glance.
 * Run: npm run ux:screens
 */
import { chromium, Page } from '@playwright/test';
import fs from 'fs';

const OUT = 'docs/ux';
const BASE = 'https://www.saucedemo.com';

async function login(page: Page) {
  await page.goto(BASE);
  await page.fill('[data-test="username"]', 'standard_user');
  await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]');
  await page.waitForSelector('[data-test="inventory-list"]');
}

/** Outline elements and pin a note below `anchor` (defaults to the first outlined element). */
async function mark(page: Page, selector: string, note?: string, anchor?: string) {
  await page.evaluate(([sel, txt, anc]) => {
    document.querySelectorAll('.ux-note').forEach(n => n.remove()); // SPA keeps body between routes
    const els = [...document.querySelectorAll<HTMLElement>(sel!)];
    els.forEach(el => { el.style.outline = '3px solid #e0007a'; el.style.outlineOffset = '3px'; });
    const at = anc ? document.querySelector<HTMLElement>(anc) : els[0];
    if (txt && at) {
      const r = at.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      const tag = document.createElement('div');
      tag.className = 'ux-note';
      tag.textContent = txt;
      Object.assign(tag.style, {
        position: 'absolute', left: `${Math.max(8, Math.min(r.left, window.innerWidth - width - 8))}px`, width: `${width}px`, boxSizing: 'border-box', top: `${r.bottom + window.scrollY + 10}px`,
        background: '#e0007a', color: '#fff', font: '600 14px/1.3 system-ui, sans-serif',
        padding: '6px 10px', borderRadius: '6px', zIndex: '9999',
      });
      document.body.appendChild(tag);
    }
  }, [selector, note, anchor]);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // 1. Empty cart can be checked out -> "$0.00 order dispatched"
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await login(page);
    await page.click('[data-test="shopping-cart-link"]');
    await page.waitForSelector('[data-test="checkout"]');
    await mark(page, '[data-test="checkout"]', 'Cart is empty, yet Checkout is enabled and gives no empty-state hint');
    await page.screenshot({ path: `${OUT}/1a-empty-cart.png` });
    await page.click('[data-test="checkout"]');
    await page.fill('[data-test="firstName"]', 'Ada');
    await page.fill('[data-test="lastName"]', 'Lovelace');
    await page.fill('[data-test="postalCode"]', '12345');
    await page.click('[data-test="continue"]');
    await page.waitForSelector('[data-test="total-label"]');
    await mark(page, '[data-test="total-label"], [data-test="finish"]', '...and a $0.00 order with no items can be placed ("Thank you for your order!")', '[data-test="total-label"]');
    await page.screenshot({ path: `${OUT}/1b-empty-order-overview.png` });
    await page.close();
  }

  // 2. Checkout form: one error at a time, every field turns red, placeholder-only labels
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await login(page);
    await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
    await page.click('[data-test="shopping-cart-link"]');
    await page.waitForSelector('[data-test="checkout"]');
    await page.click('[data-test="checkout"]');
    await page.fill('[data-test="lastName"]', 'Lovelace');
    await page.fill('[data-test="postalCode"]', '12345');
    await page.click('[data-test="continue"]');
    await page.waitForSelector('[data-test="error"]');
    await mark(page, '.checkout_info input', 'Only First Name is missing, but all 3 fields turn red. Labels are placeholders only, so they vanish once you type.', '[data-test="error"]');
    await page.screenshot({ path: `${OUT}/2-checkout-form-errors.png` });
    await page.close();
  }

  // 3. Cart: fixed quantity, no thumbnails, no running total
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await login(page);
    await page.click('[data-test="add-to-cart-sauce-labs-bolt-t-shirt"]');
    await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
    await page.click('[data-test="shopping-cart-link"]');
    await page.waitForSelector('[data-test="checkout"]');
    await mark(page, '[data-test="item-quantity"]', 'Quantity is read-only: no way to buy 2. No image, no subtotal in the cart.');
    await page.screenshot({ path: `${OUT}/3-cart-no-quantity.png` });
    await page.close();
  }

  // 4. Mobile: first "Add to cart" below the fold, icon-only sort control
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page);
    const y = await page.evaluate(() => document.querySelector('[data-test="add-to-cart-sauce-labs-backpack"]')!.getBoundingClientRect().top);
    console.log(`mobile: first Add-to-cart button top = ${Math.round(y)}px (viewport 812px)`);
    await mark(page, '.select_container', `Sort is an unlabeled funnel icon. Price and "Add to cart" start ${Math.round(y)}px down, below the fold.`, '.inventory_item_desc');
    await page.screenshot({ path: `${OUT}/4-mobile-inventory.png` });
    await ctx.close();
  }

  // 5. Product content contradicts itself / developer jargon in the shop
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await login(page);
    await page.click('text=Test.allTheThings() T-Shirt (Red)');
    await page.waitForSelector('.inventory_details_name');
    await mark(page, '.inventory_details_name, .inventory_details_img', 'Named a "T-Shirt", pictured as a long-sleeve sweatshirt; the name reads like code', 'button.btn_inventory');
    await page.screenshot({ path: `${OUT}/5-product-mismatch.png` });
    await page.close();
  }

  await browser.close();
  console.log(`screenshots written to ${OUT}/`);
})();
