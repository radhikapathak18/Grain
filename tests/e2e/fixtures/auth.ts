import type { Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ProductSelectPage } from '../pages/ProductSelectPage';
import { SEEDED } from './users';

/**
 * Shared "signed-in + products confirmed" entry helper. Drives the real
 * login form and the real ProductSelect confirmation so the persisted
 * Zustand state matches what production code paths would set — we never
 * inject directly into localStorage from a test.
 */
export async function signInAsResearcher(page: Page): Promise<void> {
  const login = new LoginPage(page);
  await login.goto();
  await login.login(SEEDED.researcher.email, 'researcher');

  const select = new ProductSelectPage(page);
  // The login navigates to /select automatically.
  await select.confirm();
}
