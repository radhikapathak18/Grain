/**
 * /chat — three baseline states:
 *   1. Empty hero (no messages — example prompt grid visible).
 *   2. Mid-stream: assistant bubble with status trail + partial text. We
 *      drive the mock to emit a fixed payload and let it finish, so what
 *      we actually capture is the *deterministic completed* bubble (the
 *      mock has no pause). This is the "mid-stream final frame" baseline.
 *   3. Completed bubble + open evidence panel (covers EvidencePanel layout
 *      against the chat content shifted left).
 *
 * The status trail collapses to a "3 steps" summary once text begins; we
 * screenshot that collapsed state so the prose region is the focal point.
 */
import { test, expect } from '@playwright/test';
import { stabilize, waitForCalm, signInAndPickProduct } from '../_helpers';

test.beforeEach(async ({ page }) => {
  await stabilize(page);
});

test('/chat — empty hero', async ({ page }) => {
  await signInAndPickProduct(page);
  // The hero copy is the most stable element to wait for.
  await page.getByText(/ask grain anything/i).waitFor();
  await expect(page).toHaveScreenshot('chat-empty-hero.png', { fullPage: true });
});

test('/chat — completed assistant message with citation', async ({ page }) => {
  await signInAndPickProduct(page);
  // Use the explore example prompt to send a question. The mock returns a
  // fixed delta sequence ending in "[CL-0001]." so the bubble always
  // settles to the same final text.
  await page.getByRole('button', { name: /onboarding pain points/i }).click();
  // Wait for the citation chip to render — that's the last DOM mutation.
  await page.getByRole('button', { name: /CL-0001/i }).waitFor();
  await waitForCalm(page);
  await expect(page).toHaveScreenshot('chat-completed-citation.png', {
    fullPage: true,
  });
});

test('/chat — evidence panel open over completed message', async ({ page }) => {
  await signInAndPickProduct(page);
  await page.getByRole('button', { name: /onboarding pain points/i }).click();
  await page.getByRole('button', { name: /CL-0001/i }).waitFor();
  // Click the citation chip to open the panel.
  await page.getByRole('button', { name: /CL-0001/i }).first().click();
  // Wait for the panel dialog + claim text to render.
  await page.getByRole('dialog', { name: /evidence panel/i }).waitFor();
  await page.getByText(/three weeks longer/i).first().waitFor();
  await waitForCalm(page);
  await expect(page).toHaveScreenshot('chat-evidence-panel-open.png', {
    fullPage: true,
  });
});
