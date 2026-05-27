import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page object for /source/:id.
 */
export class SourcePage {
  readonly page: Page;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backButton = page.getByRole('button', { name: /^back$/i }).first();
  }

  async gotoId(id: string, passage?: string) {
    const qs = passage ? `?passage=${encodeURIComponent(passage)}` : '';
    await this.page.goto(`/source/${encodeURIComponent(id)}${qs}`);
  }

  title(): Locator {
    return this.page.locator('h1');
  }

  bodyHeading(): Locator {
    return this.page.getByRole('heading', { name: /full (transcript|thread|document)/i });
  }

  highlights(): Locator {
    return this.page.locator('mark');
  }

  excerptList(): Locator {
    return this.page.locator('h2:has-text("Cited passages") + ul li, h2:has-text("excerpt") + ul li');
  }

  errorBlock(): Locator {
    return this.page.getByText(/source not found/i);
  }

  async expectVisible() {
    await expect(this.title()).toBeVisible();
  }
}
