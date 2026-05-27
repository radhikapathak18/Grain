import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page object for /select.
 *
 * The product picker is a list of buttons with role="checkbox" inside a
 * role="group" container labelled "Products". Continue button is
 * disabled while zero items are selected.
 */
export class ProductSelectPage {
  readonly page: Page;
  readonly group: Locator;
  readonly continueButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.group = page.getByRole('group', { name: /products/i });
    this.continueButton = page.getByRole('button', { name: /continue/i });
  }

  async goto() {
    await this.page.goto('/select');
    await expect(this.group).toBeVisible();
  }

  productCheckbox(productLabel: string | RegExp): Locator {
    return this.page.getByRole('checkbox', { name: productLabel });
  }

  /**
   * Confirm with all currently-selected products (or pick the first one
   * if none are pre-checked).
   */
  async confirm() {
    const checked = await this.page.locator('[role="checkbox"][aria-checked="true"]').count();
    if (checked === 0) {
      await this.page.locator('[role="checkbox"]').first().click();
    }
    await this.continueButton.click();
  }
}
