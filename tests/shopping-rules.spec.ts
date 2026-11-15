/** Business rules a real shop should enforce, checked as standard_user. */
import { test, expect } from '@playwright/test';
import { Shop } from './support/pages';
import { CATALOG } from './support/users';

test.beforeEach(async ({ page }) => { await new Shop(page).loginAndWait('standard_user'); });

test('full cart: totals add up with 8% tax', async ({ page }) => {
  const shop = new Shop(page);
  for (const { name } of CATALOG) await shop.item(name).locator('button', { hasText: 'Add to cart' }).click();
  await expect(shop.badge).toHaveText('6');
  await shop.openCart();
  await expect(page.getByTestId('inventory-item')).toHaveCount(6);
  await page.getByTestId('checkout').click();
  await shop.fillInfo('Ada', 'Lovelace', '12345');
  await page.getByTestId('continue').click();
  const s = await shop.summary();
  const expected = CATALOG.reduce((a, i) => a + i.price, 0);
  expect(s.subtotal).toBeCloseTo(expected, 2);
  expect(s.tax).toBeCloseTo(Math.round(expected * 8) / 100, 2);
  expect(s.total).toBeCloseTo(s.subtotal + s.tax, 2);
});

test('remove from cart page updates badge and list', async ({ page }) => {
  const shop = new Shop(page);
  await shop.item('Sauce Labs Onesie').locator('button', { hasText: 'Add to cart' }).click();
  await shop.item('Sauce Labs Bike Light').locator('button', { hasText: 'Add to cart' }).click();
  await shop.openCart();
  await page.getByTestId('remove-sauce-labs-onesie').click();
  await expect(page.getByTestId('inventory-item')).toHaveCount(1);
  await expect(shop.badge).toHaveText('1');
});

test('cart survives logout and login', async ({ page }) => {
  const shop = new Shop(page);
  await shop.item('Sauce Labs Onesie').locator('button', { hasText: 'Add to cart' }).click();
  await shop.menu('logout');
  await shop.loginAndWait('standard_user');
  await expect(shop.badge).toHaveText('1');
});

test('cancel on overview returns to shop with cart intact', async ({ page }) => {
  const shop = new Shop(page);
  await shop.item('Sauce Labs Onesie').locator('button', { hasText: 'Add to cart' }).click();
  await shop.openCart();
  await page.getByTestId('checkout').click();
  await shop.fillInfo('Ada', 'Lovelace', '12345');
  await page.getByTestId('continue').click();
  await page.getByTestId('cancel').click();
  await expect(page).toHaveURL(/inventory/);
  await expect(shop.badge).toHaveText('1');
});

test('checkout form requires each field', async ({ page }) => {
  const shop = new Shop(page);
  await page.goto('/checkout-step-one.html');
  const cont = page.getByTestId('continue');
  await cont.click();
  await expect(shop.error).toContainText('First Name is required');
  await page.getByTestId('firstName').fill('Ada');
  await cont.click();
  await expect(shop.error).toContainText('Last Name is required');
  await page.getByTestId('lastName').fill('Lovelace');
  await cont.click();
  await expect(shop.error).toContainText('Postal Code is required');
});

test.describe('known defects (standard_user)', () => {
  test('BUG-17: checkout is blocked when the cart is empty', async ({ page }) => {
    test.fail(!process.env.SHOW_BUGS, 'BUG-17: an empty cart can be "ordered" for $0.00');
    const shop = new Shop(page);
    await shop.openCart();
    await expect(page.getByTestId('checkout')).toBeDisabled({ timeout: 2_000 });
  });

  test('BUG-18: whitespace-only names are rejected', async ({ page }) => {
    test.fail(!process.env.SHOW_BUGS, 'BUG-18: "   " passes the required-field check');
    const shop = new Shop(page);
    await shop.item('Sauce Labs Onesie').locator('button', { hasText: 'Add to cart' }).click();
    await shop.openCart();
    await page.getByTestId('checkout').click();
    await shop.fillInfo('   ', '   ', '   ');
    await page.getByTestId('continue').click();
    await expect(shop.error).toBeVisible({ timeout: 2_000 });
  });

  test('BUG-19: "Reset App State" also resets Add/Remove buttons', async ({ page }) => {
    test.fail(!process.env.SHOW_BUGS, 'BUG-19: badge clears but buttons keep saying "Remove" until reload');
    const shop = new Shop(page);
    await shop.item('Sauce Labs Backpack').locator('button', { hasText: 'Add to cart' }).click();
    await shop.menu('reset');
    await expect(shop.badge).toHaveCount(0);
    await expect(shop.item('Sauce Labs Backpack').locator('button')).toHaveText('Add to cart', { timeout: 2_000 });
  });
});
