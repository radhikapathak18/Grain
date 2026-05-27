/**
 * /chat — ChatView.
 *
 * Tested states:
 *  1. Empty hero (no messages yet)
 *  2. Populated with a finished assistant turn (streaming = false)
 *
 * Reaching a *live* streaming state in jsdom would require driving the SSE
 * reader — too brittle for an a11y test. Instead we synthesize the DOM
 * snapshot of a mid-stream message (text="", statuses=[…], isStreaming=true)
 * via the MessageList directly; that test lives in components/MessageBubble.
 *
 * a11y contract for the page:
 *  - <main> landmark with id="main" (for skip link target)
 *  - error UI uses role="alert" (verified by routing test)
 *  - **FINDING: streaming assistant text is NOT in an aria-live region.**
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ChatView } from '../../../apps/web/src/views/ChatView';
import { useSessionStore } from '../../../apps/web/src/state/session';
import { renderWithProviders } from '../lib/render';
import { axeRun, formatViolations } from '../lib/axe';
import {
  makeUser,
  AVAILABLE_PRODUCTS,
  makeAssistantMessage,
  makeUserMessage,
} from '../../fixtures/a11y';

beforeEach(() => {
  // Default: signed in, no messages → renders the empty hero.
  useSessionStore.setState({
    user: makeUser(),
    availableProducts: AVAILABLE_PRODUCTS,
    selectedProducts: ['helix-core', 'p4v'],
    questionShape: 'explore',
    loginComplete: true,
    productsConfirmed: true,
    history: [],
  });
  // Stub fetch so any background useClaim() doesn't fail noisily.
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ claims: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
});

describe('ChatView (/chat) — a11y — empty state', () => {
  it('renders a <main> landmark with id="main" (skip target)', () => {
    renderWithProviders(<ChatView />, { route: '/chat' });
    const main = screen.getByRole('main');
    expect(main.id).toBe('main');
  });

  it('empty hero exposes example-prompt buttons with accessible names', () => {
    renderWithProviders(<ChatView />, { route: '/chat' });
    expect(screen.getByRole('button', { name: /onboarding pain points/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /merge performance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cli feedback/i })).toBeInTheDocument();
  });

  it('axe: empty state', async () => {
    const { container } = renderWithProviders(<ChatView />, { route: '/chat' });
    const results = await axeRun(container);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'ChatView [empty] a11y violations:\n' + formatViolations(results),
      );
    }
    expect(results).toHaveNoViolations();
  });
});

describe('ChatView (/chat) — a11y — with completed turn', () => {
  beforeEach(() => {
    useSessionStore.setState((s) => ({
      ...s,
      history: [
        makeUserMessage('What are the top P4V onboarding pains?'),
        makeAssistantMessage(),
      ],
    }));
  });

  it('renders the assistant text', () => {
    renderWithProviders(<ChatView />, { route: '/chat' });
    expect(screen.getByText(/helix core onboarding/i)).toBeInTheDocument();
  });

  it('FINDING: assistant message container is NOT in an aria-live region', () => {
    const { container } = renderWithProviders(<ChatView />, { route: '/chat' });
    const liveRegions = container.querySelectorAll(
      '[aria-live], [role="status"], [role="log"]',
    );
    if (liveRegions.length === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '[a11y FINDING] ChatView: no aria-live region wraps the assistant ' +
          'message stream. Screen reader users will not hear streaming ' +
          'tokens. Recommend role="log" or aria-live="polite" on MessageList.',
      );
    }
    expect(liveRegions.length).toBe(0); // documents current state
  });

  it('axe: populated chat', async () => {
    const { container } = renderWithProviders(<ChatView />, { route: '/chat' });
    const results = await axeRun(container);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'ChatView [populated] a11y violations:\n' + formatViolations(results),
      );
    }
    expect(results).toHaveNoViolations();
  });
});
