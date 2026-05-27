import { expect, test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ProductSelectPage } from '../pages/ProductSelectPage';
import { ChatPage } from '../pages/ChatPage';
import { SEEDED } from '../fixtures/users';

/**
 * Journey 1 — Happy path
 *
 *   Login (researcher) → confirm products → ask Explore question →
 *   status events appear → assistant text streams in → at least one
 *   citation chip is visible → click chip → evidence panel opens with
 *   claim text + evidence → close panel → switch role to PM → ask the
 *   SAME question → bubble re-renders ("Answered as Product Manager").
 *
 * We assert on the DOM (which the user sees), not on Claude's specific
 * output — the mock-claude shim emits deterministic text plus the
 * [CL-0001] / [CL-0002] markers the route's citation scanner picks up.
 */

test('happy path: login → ask → cite → switch role → re-ask', async ({ page }) => {
  // ── Login
  const login = new LoginPage(page);
  await login.goto();
  await login.login(SEEDED.researcher.email, 'researcher');

  // ── Product select
  const select = new ProductSelectPage(page);
  await expect(page).toHaveURL(/\/select$/);
  await select.confirm();
  await expect(page).toHaveURL(/\/chat$/);

  // ── Chat: send an Explore question
  const chat = new ChatPage(page);
  await chat.send('What are the top onboarding pain points across Helix Core and P4V?');

  // Wait for streaming to fully settle (send button re-enables when done).
  await chat.waitForStreamSettled();

  // Latest assistant bubble has non-empty text.
  const assistantText = chat.latestAssistantText();
  await expect(assistantText).toBeVisible();
  const text = (await assistantText.innerText()).trim();
  expect(text.length).toBeGreaterThan(10);

  // At least one citation chip appeared (the mock emits [CL-0001] and
  // [CL-0002] markers).
  await expect.poll(() => chat.citationCount(), { timeout: 10_000 }).toBeGreaterThan(0);

  // ── Open the evidence panel via the first citation chip
  await chat.openFirstCitation();
  // Claim id is rendered as a font-mono span in the panel header.
  await expect(chat.evidencePanel.locator('header').getByText(/^CL-\d{4}$/)).toBeVisible();
  // The claim text body — `<p class="text-base ...">` — is the first
  // paragraph in the scrollable area.
  await expect(chat.evidencePanel.locator('p').first()).toBeVisible();
  // Evidence count heading should render.
  await expect(chat.evidencePanel.getByRole('heading', { name: /^Evidence/i })).toBeVisible();
  await chat.closePanel();

  // Record the first answer text + bubble count for the re-ask assertion.
  const firstAnswer = await chat.latestAssistantText().innerText();
  const initialBubbleCount = await page.locator('div.items-start > div.bg-surface p').count();

  // ── Switch role to Product Manager (label from ROLE_LABELS)
  await chat.switchRole(/product manager/i);

  // ── Ask the same question again — bubble count should grow.
  await chat.send('What are the top onboarding pain points across Helix Core and P4V?');
  await chat.waitForStreamSettled();

  // A second assistant bubble exists.
  await expect
    .poll(async () => page.locator('div.items-start > div.bg-surface p').count())
    .toBeGreaterThan(initialBubbleCount);

  // New bubble should announce the PM framing.
  await expect(page.getByText(/Answered as Product Manager/i).last()).toBeVisible();

  // Sanity: at least one citation in the latest bubble (mock always emits both).
  await expect.poll(() => chat.citationCount(), { timeout: 10_000 }).toBeGreaterThan(1);

  // We deliberately do NOT assert that the text differs from the
  // researcher answer — the mock-claude shim is not role-aware. The DOM
  // reflows (new bubble, new "Answered as" label), which is what the
  // user actually sees. Real Claude output variation belongs to the
  // ai-quality-agent's eval harness.
  expect(firstAnswer).toBeTruthy();
});
