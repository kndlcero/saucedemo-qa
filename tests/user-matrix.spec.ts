/**
 * The same shopper "contract" runs against every demo user. standard_user is
 * the oracle; deviations for the deliberately buggy users are registered in
 * KNOWN_BUGS and marked as expected failures.
 */
import { test, expect } from '@playwright/test';
import { Shop, money } from './support/pages';
import { USERS, CATALOG, KNOWN_BUGS, User } from './support/users';

const byName = [...CATALOG].sort((a, b) => a.name.localeCompare(b.name));
const EXPECTED_ORDER = {
  az: byName.map(i => i.name),
  za: [...byName].reverse().map(i => i.name),
  // stable sort by price; ties keep A-Z order, which is what the site does
  lohi: [...byName].sort((a, b) => a.price - b.price).map(i => i.name),
  hilo: [...byName].sort((a, b) => b.price - a.price).map(i => i.name),
};

function check(title: keyof typeof KNOWN_BUGS, user: User, body: (shop: Shop) => Promise<void>) {
  test(title, async ({ page }) => {
    const bug = KNOWN_BUGS[title]?.[user];
    if (bug && !process.env.SHOW_BUGS) {
      test.info().annotations.push({ type: 'known-bug', description: `${bug} (${user})` });
      test.fail(true, `${bug}: known defect for ${user}`);
    }
    const shop = new Shop(page);
    await shop.loginAndWait(user);
    await body(shop);
  });
}

for (const user of USERS) {
  test.describe(user, () => {
    check('product images load', user, async shop => {
      await shop.settle();
      const srcs = await shop.page.locator('.inventory_item_img img').evaluateAll(imgs =>
        imgs.map(i => ({ src: (i as HTMLImageElement).src, ok: (i as HTMLImageElement).naturalWidth > 0 })));
      expect(srcs).toHaveLength(6);
      for (const s of srcs) {
        expect(s.ok, `${s.src} rendered`).toBe(true);
        expect(s.src, 'placeholder/404 image served instead of product photo').not.toContain('sl-404');
      }
      expect(new Set(srcs.map(s => s.src)).size, 'each product has its own photo').toBe(6);
    });

    check('sorting reorders the list', user, async shop => {
      for (const opt of ['za', 'lohi', 'hilo', 'az'] as const) {
        await shop.sortBy(opt);
        await expect.poll(() => shop.names.allTextContents(), { message: `sort ${opt}`, timeout: 10_000 })
          .toEqual(EXPECTED_ORDER[opt]);
      }
    });

    check('every item can be added', user, async shop => {
      const n = await shop.items.count();
      for (let i = 0; i < n; i++) {
        const card = shop.items.nth(i);
        await card.locator('button', { hasText: 'Add to cart' }).click();
        await expect(card.locator('button'), `item ${i} toggles to Remove`).toHaveText('Remove');
        await expect(shop.badge).toHaveText(String(i + 1));
      }
    });

    check('items can be removed', user, async shop => {
      const card = shop.item('Sauce Labs Backpack');
      await card.locator('button', { hasText: 'Add to cart' }).click();
      await expect(shop.badge).toHaveText('1');
      await card.locator('button', { hasText: 'Remove' }).click();
      await expect(shop.badge).toHaveCount(0);
      await expect(card.locator('button')).toHaveText('Add to cart');
    });

    check('product link opens that item', user, async shop => {
      for (const { name } of CATALOG) {
        await shop.names.filter({ hasText: name }).click();
        await expect(shop.page.locator('.inventory_details_name')).toHaveText(name);
        await shop.page.getByTestId('back-to-products').click();
      }
    });

    check('listed price matches cart', user, async shop => {
      const listed = await shop.item('Sauce Labs Backpack').getByTestId('inventory-item-price').textContent();
      expect(money(listed), 'listed price vs catalogue').toBe(29.99);
      await shop.item('Sauce Labs Backpack').locator('button', { hasText: 'Add to cart' }).click();
      await shop.openCart();
      await expect(shop.page.getByTestId('inventory-item-price')).toHaveText(listed!);
    });

    check('checkout form keeps input', user, async shop => {
      await shop.item('Sauce Labs Backpack').locator('button', { hasText: 'Add to cart' }).click();
      await shop.openCart();
      await shop.page.getByTestId('checkout').click();
      await shop.fillInfo('Ada', 'Lovelace', '12345');
      await expect(shop.page.getByTestId('firstName')).toHaveValue('Ada');
      await expect(shop.page.getByTestId('lastName')).toHaveValue('Lovelace');
      await expect(shop.page.getByTestId('postalCode')).toHaveValue('12345');
    });

    check('order can be completed', user, async shop => {
      for (const n of ['Sauce Labs Backpack', 'Sauce Labs Bike Light']) {
        await shop.item(n).locator('button', { hasText: 'Add to cart' }).click();
      }
      await shop.openCart();
      await shop.page.getByTestId('checkout').click();
      await shop.fillInfo('Ada', 'Lovelace', '12345');
      await shop.page.getByTestId('continue').click();
      await expect(shop.page).toHaveURL(/checkout-step-two/);
      const s = await shop.summary();
      expect(s.subtotal).toBeCloseTo(29.99 + 9.99, 2);
      expect(s.tax).toBeCloseTo(Math.round(s.subtotal * 8) / 100, 2); // 8% tax
      expect(s.total).toBeCloseTo(s.subtotal + s.tax, 2);
      await shop.page.getByTestId('finish').click();
      await expect(shop.page.getByTestId('complete-header')).toHaveText('Thank you for your order!');
      await expect(shop.badge).toHaveCount(0);
    });

    test('pages respond within 2s', async ({ page }) => {
      const bug = KNOWN_BUGS['pages respond within 2s'][user];
      if (bug && !process.env.SHOW_BUGS) test.fail(true, `${bug}: known defect for ${user}`);
      const shop = new Shop(page);
      let t = Date.now();
      await shop.login(user);
      await expect(shop.page.getByTestId('inventory-list')).toBeVisible({ timeout: 20_000 });
      const loginMs = Date.now() - t;
      t = Date.now();
      await shop.page.getByTestId('product-sort-container').selectOption('hilo');
      // users whose sort is functionally broken never reach this state; that is covered by
      // 'sorting reorders the list', so here we only time sorts that actually happen
      const sorted = await expect(shop.names.first()).toHaveText('Sauce Labs Fleece Jacket', { timeout: 10_000 })
        .then(() => true, () => false);
      const sortMs = Date.now() - t;
      test.info().annotations.push({ type: 'timing', description: `login ${loginMs}ms, sort ${sorted ? sortMs + 'ms' : 'n/a (sort broken)'}` });
      expect(loginMs, 'login → inventory').toBeLessThan(2000);
      if (sorted) expect(sortMs, 'sort response').toBeLessThan(2000);
    });

    check('layout matches standard', user, async shop => {
      await shop.settle();
      const vw = shop.page.viewportSize()!.width;
      const cart = (await shop.page.getByTestId('shopping-cart-link').boundingBox())!;
      expect(cart.x + cart.width, 'cart icon sits at the right edge of the header').toBeGreaterThan(vw - 60);
      expect(cart.y, 'cart icon sits in the header row').toBeLessThan(40);

      const boxes = await shop.items.evaluateAll(cards => cards.map(c => {
        const r = (sel: string) => c.querySelector(sel)!.getBoundingClientRect();
        const card = c.getBoundingClientRect();
        return {
          nameDx: Math.round(r('.inventory_item_name').x - r('.inventory_item_desc').x),
          btnRightGap: Math.round(card.right - r('button').right),
        };
      }));
      for (const [i, b] of boxes.entries()) {
        expect(Math.abs(b.nameDx), `item ${i}: title left-aligned with description`).toBeLessThanOrEqual(2);
        expect(b.btnRightGap, `item ${i}: button stays inside its card`).toBeGreaterThan(0);
      }
      const gaps = new Set(boxes.map(b => b.btnRightGap));
      expect(gaps.size, 'all add-to-cart buttons share the same alignment').toBe(1);
    });
  });
}
