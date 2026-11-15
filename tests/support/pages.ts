import { expect, Page, Locator } from '@playwright/test';
import { PASSWORD } from './users';

export const money = (s: string | null) => Number((s ?? '').replace(/[^0-9.]/g, ''));

export class Shop {
  constructor(readonly page: Page) {}

  // ---- login ----
  async login(user: string, password = PASSWORD) {
    await this.page.goto('/');
    await this.page.getByTestId('username').fill(user);
    await this.page.getByTestId('password').fill(password);
    await this.page.getByTestId('login-button').click();
  }
  async loginAndWait(user: string) {
    await this.login(user);
    await expect(this.page.getByTestId('inventory-list')).toBeVisible({ timeout: 20_000 });
  }
  get error(): Locator { return this.page.getByTestId('error'); }

  /** Wait until fonts and images have finished loading, before measuring geometry or image state. */
  async settle() {
    await this.page.waitForFunction(() =>
      document.fonts.status === 'loaded' && [...document.images].every(i => i.complete), null, { timeout: 15_000 });
  }

  // ---- inventory ----
  get items() { return this.page.getByTestId('inventory-item'); }
  get names() { return this.page.getByTestId('inventory-item-name'); }
  get prices() { return this.page.getByTestId('inventory-item-price'); }
  get badge() { return this.page.getByTestId('shopping-cart-badge'); }
  item(name: string) { return this.items.filter({ hasText: name }); }
  async sortBy(option: 'az' | 'za' | 'lohi' | 'hilo') {
    await this.page.getByTestId('product-sort-container').selectOption(option);
  }
  async priceList() { return (await this.prices.allTextContents()).map(money); }
  async badgeCount() { return (await this.badge.count()) ? Number(await this.badge.textContent()) : 0; }

  // ---- menu ----
  async menu(link: 'logout' | 'reset' | 'about' | 'inventory') {
    // data-test="open-menu" sits on an <img> covered by the real <button>; use the accessible button
    await this.page.getByRole('button', { name: 'Open Menu' }).click();
    await this.page.getByTestId(`${link}-sidebar-link`).click();
  }

  // ---- cart / checkout ----
  async openCart() { await this.page.getByTestId('shopping-cart-link').click(); }
  async fillInfo(first: string, last: string, zip: string) {
    await this.page.getByTestId('firstName').fill(first);
    await this.page.getByTestId('lastName').fill(last);
    await this.page.getByTestId('postalCode').fill(zip);
  }
  async summary() {
    return {
      subtotal: money(await this.page.getByTestId('subtotal-label').textContent()),
      tax: money(await this.page.getByTestId('tax-label').textContent()),
      total: money(await this.page.getByTestId('total-label').textContent()),
    };
  }
}
