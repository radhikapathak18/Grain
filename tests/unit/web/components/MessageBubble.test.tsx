// Unit tests for apps/web/src/components/MessageBubble.tsx.
//
// MessageBubble renders user / assistant bubbles. We assert the visible
// affordances that gate the demo UX: typing indicator, status trail
// collapse, citation parsing into chips, copy + regenerate buttons.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { MessageBubble } from '../../../../apps/web/src/components/MessageBubble.tsx';
import type { ChatMessage, StatusStep } from '@grain/types';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    role: 'assistant',
    text: '',
    createdAt: '2026-05-26T12:34:00Z',
    citations: [],
    statuses: [],
    asRole: 'pm',
    shape: 'explore',
    ...overrides,
  };
}

beforeEach(() => {
  // Some tests load citations; stub fetch so it doesn't hit the network.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MessageBubble — user role', () => {
  it('renders the user text verbatim, no citation parsing', () => {
    render(
      <MessageBubble
        message={makeMessage({ role: 'user', text: 'Hello [CL-0001]' })}
      />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByText(/Hello \[CL-0001\]/)).toBeInTheDocument();
  });

  it('hides Copy / Ask again on user bubbles', () => {
    render(
      <MessageBubble
        message={makeMessage({ role: 'user', text: 'q' })}
        onRegenerate={() => undefined}
        isLastAssistant
      />,
      { wrapper: makeWrapper() },
    );
    expect(screen.queryByLabelText('Copy answer')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ask again')).not.toBeInTheDocument();
  });
});

describe('MessageBubble — assistant role', () => {
  it('shows the typing indicator while streaming with no text yet', () => {
    render(
      <MessageBubble
        message={makeMessage({ text: '' })}
        isStreaming
      />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByLabelText('Grain is working')).toBeInTheDocument();
  });

  it('parses [CL-NNNN] markers into clickable chips', () => {
    render(
      <MessageBubble
        message={makeMessage({
          text: 'Lead synthesis. Reason A [CL-0001]. Reason B [CL-0002].',
        })}
      />,
      { wrapper: makeWrapper() },
    );
    // Each chip renders the id as a button.
    expect(
      screen.getByRole('button', { name: /CL-0001/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /CL-0002/ }),
    ).toBeInTheDocument();
  });

  it('shows the "Framed for PM" role label', () => {
    render(<MessageBubble message={makeMessage({ asRole: 'pm', text: 'x' })} />, {
      wrapper: makeWrapper(),
    });
    expect(screen.getByText(/Framed for PM/)).toBeInTheDocument();
  });

  it('renders Copy + Ask again controls once streaming is done', () => {
    const onRegenerate = vi.fn();
    render(
      <MessageBubble
        message={makeMessage({ text: 'done text' })}
        isLastAssistant
        onRegenerate={onRegenerate}
      />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByLabelText('Copy answer')).toBeInTheDocument();
    const askAgain = screen.getByLabelText('Ask again');
    fireEvent.click(askAgain);
    expect(onRegenerate).toHaveBeenCalled();
  });

  it('omits Ask again when this is NOT the last assistant message', () => {
    render(
      <MessageBubble
        message={makeMessage({ text: 'done' })}
        isLastAssistant={false}
        onRegenerate={() => undefined}
      />,
      { wrapper: makeWrapper() },
    );
    expect(screen.queryByLabelText('Ask again')).not.toBeInTheDocument();
  });

  it('omits Copy/Ask while still streaming', () => {
    render(
      <MessageBubble
        message={makeMessage({ text: 'partial' })}
        isStreaming
        isLastAssistant
        onRegenerate={() => undefined}
      />,
      { wrapper: makeWrapper() },
    );
    expect(screen.queryByLabelText('Copy answer')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ask again')).not.toBeInTheDocument();
  });
});

describe('MessageBubble — status trail', () => {
  const statuses: StatusStep[] = [
    { phase: 'searching', message: 'Searching customer research…' },
    { phase: 'retrieved', message: 'Found 6 claims spanning workspace setup.' },
    { phase: 'synthesizing', message: 'Synthesizing answer for a PM audience…' },
  ];

  it('renders the full status list while text has not started', () => {
    render(
      <MessageBubble
        message={makeMessage({ text: '', statuses })}
        isStreaming
      />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByText(statuses[0]!.message)).toBeInTheDocument();
    expect(screen.getByText(statuses[1]!.message)).toBeInTheDocument();
    expect(screen.getByText(statuses[2]!.message)).toBeInTheDocument();
  });

  it('collapses to a summary line once text has begun', () => {
    render(
      <MessageBubble
        message={makeMessage({ text: 'first words.', statuses })}
        isStreaming
      />,
      { wrapper: makeWrapper() },
    );
    // The collapsed summary reads "3 steps".
    expect(screen.getByLabelText('Show synthesis steps')).toBeInTheDocument();
    expect(screen.getByText('3 steps')).toBeInTheDocument();
    // Individual messages are NOT rendered in the collapsed view.
    expect(screen.queryByText(statuses[0]!.message)).not.toBeInTheDocument();
  });

  it('expanding the collapsed summary reveals every step', () => {
    render(
      <MessageBubble
        message={makeMessage({ text: 'words', statuses })}
      />,
      { wrapper: makeWrapper() },
    );
    fireEvent.click(screen.getByLabelText('Show synthesis steps'));
    for (const s of statuses) {
      expect(screen.getByText(s.message)).toBeInTheDocument();
    }
  });
});
