import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page object for /login.
 *
 * The login form is a single <form> with one email input, one role
 * <select>, and a single submit button labeled "Sign in". On success the
 * app navigates to /select; on 401 it renders an inline error chip
 * inside the form.
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly roleSelect: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"]');
    this.roleSelect = page.locator('select');
    this.submitButton = page.getByRole('button', { name: /sign in/i });
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.emailInput).toBeVisible();
  }

  async login(email: string, role: 'researcher' | 'pm' | 'designer' | 'engineer' = 'researcher') {
    // Clear any pre-filled dev email before typing.
    await this.emailInput.fill('');
    await this.emailInput.fill(email);
    await this.roleSelect.selectOption(role);
    await this.submitButton.click();
  }

  /** Reads the inline error message rendered for a failed login. */
  errorMessage(): Locator {
    return this.page.locator('form .text-error');
  }
}
