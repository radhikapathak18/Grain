/**
 * MessageBubble — assistant + user chat bubble. 275 LOC, multiple states:
 *  - user vs assistant
 *  - typing indicator (showTyping)
 *  - status trail (collapsed vs expanded)
 *  - streaming cursor
 *  - copy / regenerate buttons
 *  - inline citation chips
 *
 * a11y contract:
 *  - decorative SVGs/avatars are aria-hidden
 *  - typing indicator surfaces accessible text ("Assistant is typing")
 *  - copy button has aria-label
 *  - regenerate button has aria-label
 *  - status-trail collapsed button has aria-label
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { MessageBubble } from '../../../apps/web/src/components/MessageBubble';
import { renderWithProviders } from '../lib/render';
import { axeRun, formatViolations } from '../lib/axe';
import {
  makeAssistantMessage,
  makeStatuses,
  makeUserMessage,
} from '../../fixtures/a11y';

describe('MessageBubble — a11y', () => {
  it('user bubble: no axe violations', async () => {
    const { container } = renderWithProviders(
      <MessageBubble message={makeUserMessage('What are top onboarding pains?')} />,
    );
    const results = await axeRun(container);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'MessageBubble [user] a11y violations:\n' + formatViolations(results),
      );
    }
    expect(results).toHaveNoViolations();
  });

  it('assistant streaming-typing state: typing indicator has accessible label', () => {
    const { container } = renderWithProviders(
      <MessageBubble
        message={makeAssistantMessage({ text: '', citations: [], statuses: [] })}
        isStreaming
      />,
    );
    // The aria-label "Assistant is typing" must exist on the typing dots.
    expect(container.querySelector('[aria-label="Assistant is typing"]')).toBeTruthy();
  });

  it('assistant with statuses, no text yet: status trail rendered', () => {
    const { container } = renderWithProviders(
      <MessageBubble
        message={makeAssistantMessage({ text: '', citations: [], statuses: makeStatuses() })}
        isStreaming
      />,
    );
    expect(container.textContent).toContain('Searching');
  });

  it('assistant complete with text + citations: axe pass', async () => {
    const { container } = renderWithProviders(
      <MessageBubble
        message={makeAssistantMessage()}
        isStreaming={false}
        isLastAssistant
        onRegenerate={() => {}}
      />,
    );
    const results = await axeRun(container);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'MessageBubble [assistant complete] a11y violations:\n' +
          formatViolations(results),
      );
    }
    expect(results).toHaveNoViolations();
  });

  it('Copy button has accessible name', () => {
    renderWithProviders(
      <MessageBubble
        message={makeAssistantMessage()}
        isLastAssistant
        onRegenerate={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /copy answer/i })).toBeInTheDocument();
  });

  it('Ask-again button has accessible name when last assistant + onRegenerate', () => {
    renderWithProviders(
      <MessageBubble
        message={makeAssistantMessage()}
        isLastAssistant
        onRegenerate={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /ask again/i })).toBeInTheDocument();
  });

  it('Streaming cursor is aria-hidden so it is not announced', () => {
    const { container } = renderWithProviders(
      <MessageBubble message={makeAssistantMessage()} isStreaming />,
    );
    const cursor = container.querySelector(
      'span.inline-block.w-\\[2px\\]',
    );
    if (cursor) {
      expect(cursor.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
