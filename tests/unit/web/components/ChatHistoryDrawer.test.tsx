// Unit tests for apps/web/src/components/ChatHistoryDrawer.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ChatHistoryDrawer } from '../../../../apps/web/src/components/ChatHistoryDrawer.tsx';
import { useSessionStore } from '../../../../apps/web/src/state/session.ts';
import type { ChatMessage } from '@grain/types';

function makeUserMessage(text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    text,
    createdAt: new Date().toISOString(),
  };
}

function makeAssistantMessage(text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    text,
    createdAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  useSessionStore.getState().reset();
});

afterEach(() => {
  useSessionStore.getState().reset();
  vi.restoreAllMocks();
});

describe('ChatHistoryDrawer', () => {
  it('shows the empty state message when there are no conversations', () => {
    render(<ChatHistoryDrawer open={true} onClose={() => undefined} />);

    expect(
      screen.getByText(/No conversations yet/i),
    ).toBeInTheDocument();
  });

  it('renders a list item for each conversation in the store', () => {
    // Seed two conversations directly into the store.
    act(() => {
      const store = useSessionStore.getState();
      const firstTabId = store.activeTabId;
      // First conversation.
      store.appendMessageToTab(firstTabId, makeUserMessage('What are P4V pain points?'));
      store.openNewTab();
      // Second conversation.
      const secondTabId = useSessionStore.getState().activeTabId;
      store.appendMessageToTab(secondTabId, makeUserMessage('How has CLI feedback shifted?'));
      store.openNewTab();
    });

    render(<ChatHistoryDrawer open={true} onClose={() => undefined} />);

    expect(screen.getByText('What are P4V pain points?')).toBeInTheDocument();
    expect(screen.getByText('How has CLI feedback shifted?')).toBeInTheDocument();
  });

  it('calls loadConversation and onClose when a conversation item is clicked', () => {
    const onClose = vi.fn();

    // Seed one conversation.
    act(() => {
      const store = useSessionStore.getState();
      const tabId = store.activeTabId;
      store.appendMessageToTab(tabId, makeUserMessage('Explore onboarding issues'));
      store.openNewTab();
    });

    render(<ChatHistoryDrawer open={true} onClose={onClose} />);

    // Click the conversation row.
    fireEvent.click(screen.getByText('Explore onboarding issues'));

    // The conversation should now be active in the store.
    const { conversations, activeConversationId } = useSessionStore.getState();
    expect(activeConversationId).toBe(conversations[0]?.id);

    // onClose must have been called.
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('removes a conversation when its delete button is clicked', () => {
    act(() => {
      const store = useSessionStore.getState();
      const tabId = store.activeTabId;
      store.appendMessageToTab(tabId, makeUserMessage('Verify merge performance'));
      store.appendMessageToTab(tabId, makeAssistantMessage('Here is the evidence.'));
      store.openNewTab();
    });

    render(<ChatHistoryDrawer open={true} onClose={() => undefined} />);

    const deleteBtn = screen.getByRole('button', {
      name: /Delete conversation: Verify merge performance/i,
    });
    fireEvent.click(deleteBtn);

    expect(useSessionStore.getState().conversations).toHaveLength(0);
    expect(screen.queryByText('Verify merge performance')).not.toBeInTheDocument();
  });
});
