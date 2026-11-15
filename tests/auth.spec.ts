import { test, expect } from '@playwright/test';
import { Shop } from './support/pages';

test.describe('authentication', () => {
  test('locked_out_user is refused with a clear message', async ({ page }) => {
    const shop = new Shop(page);
    await shop.login('locked_out_user');
    await expect(shop.error).toHaveText('Epic sadface: Sorry, this user has been locked out.');
    await expect(page).not.toHaveURL(/inventory/);
  });

  test('empty username is rejected', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('login-button').click();
    await expect(new Shop(page).error).toContainText('Username is required');
  });

  test('empty password is rejected', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('username').fill('standard_user');
    await page.getByTestId('login-button').click();
    await expect(new Shop(page).error).toContainText('Password is required');
  });

  test('wrong password is rejected', async ({ page }) => {
    const shop = new Shop(page);
    await shop.login('standard_user', 'not-the-password');
    await expect(shop.error).toContainText('do not match any user');
  });

  test('error banner can be dismissed', async ({ page }) => {
    const shop = new Shop(page);
    await shop.login('standard_user', 'nope');
    await page.locator('.error-button').click();
    await expect(shop.error).toHaveCount(0);
  });

  test('protected pages redirect to login when signed out', async ({ page }) => {
    for (const path of ['/inventory.html', '/cart.html', '/checkout-step-one.html']) {
      await page.goto(path);
      await expect(new Shop(page).error).toContainText(`You can only access '${path}' when you are logged in`);
    }
  });

  test('logout ends the session, back button does not reveal the shop', async ({ page }) => {
    const shop = new Shop(page);
    await shop.loginAndWait('standard_user');
    await shop.menu('logout');
    await expect(page.getByTestId('login-button')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('inventory-list')).toHaveCount(0);
  });
});
