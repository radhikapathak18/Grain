import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page object for /report.
 */
export class ReportPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly evidencePanel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /monthly research synthesis/i });
    this.evidencePanel = page.getByRole('dialog', { name: /evidence panel/i });
  }

  async goto() {
    await this.page.goto('/report');
    await expect(this.heading).toBeVisible();
  }

  themeCards(): Locator {
    return this.page.locator('h2:has-text("Top themes") + div > *');
  }

  emergingSection(): Locator {
    return this.page.getByRole('heading', { name: /emerging issues/i });
  }

  citationChips(): Locator {
    return this.page.getByRole('button').filter({ hasText: /^CL-\d{4}/ });
  }
}
