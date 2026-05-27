import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ChatMessage, Product, User } from '@grain/types';
import { useSessionStore } from '../../src/state/session';

const PRODUCTS: Product[] = [
  { id: 'helix-core', displayName: 'Helix Core' },
  { id: 'p4v', displayName: 'P4V' },
  { id: 'helix-swarm', displayName: 'P4 Code Review (Helix Swarm)' },
];

const USER: User = {
  email: 'isathe@perforce.com',
  role: 'researcher',
  products: ['helix-core', 'p4v', 'helix-swarm'],
};

function reset() {
  useSessionStore.getState().reset();
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    text: 'hi',
    createdAt: '2026-05-26T00:00:00Z',
    ...overrides,
  };
}

// Helper: get messages for the active tab.
function getActiveMessages() {
  const { tabs, activeTabId } = useSessionStore.getState();
  return tabs.find((t) => t.id === activeTabId)?.messages ?? [];
}

beforeEach(() => {
  reset();
});

afterEach(() => {
  reset();
});

describe('useSessionStore initial state', () => {
  it('starts with no user and empty selections', () => {
    const s = useSessionStore.getState();
    expect(s.user).toBeNull();
    expect(s.availableProducts).toEqual([]);
    expect(s.selectedProducts).toEqual([]);
    expect(s.questionShape).toBe('explore');
    expect(s.loginComplete).toBe(false);
    expect(s.productsConfirmed).toBe(false);
    // Messages live in the active tab, not a top-level history field.
    expect(getActiveMessages()).toEqual([]);
  });

  it('starts with one default tab with empty messages', () => {
    const { tabs, activeTabId } = useSessionStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.id).toBe(activeTabId);
    expect(tabs[0]!.messages).toEqual([]);
    expect(tabs[0]!.title).toBe('New chat');
  });
});

describe('setSession', () => {
  it('marks login complete and seeds availableProducts + selectedProducts', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    const s = useSessionStore.getState();
    expect(s.user).toEqual(USER);
    expect(s.availableProducts).toEqual(PRODUCTS);
    expect(s.selectedProducts).toEqual(USER.products);
    expect(s.loginComplete).toBe(true);
    // Critical: products must NOT be confirmed yet — the user still
    // needs to pass through the product-select screen.
    expect(s.productsConfirmed).toBe(false);
  });

  it('overrides any previously confirmed products on re-login', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().confirmProducts();
    expect(useSessionStore.getState().productsConfirmed).toBe(true);
    // Simulate re-login (e.g. switching user via /login).
    useSessionStore.getState().setSession(
      { ...USER, email: 'pm@perforce.com', products: ['helix-core'] },
      [PRODUCTS[0]!],
    );
    expect(useSessionStore.getState().productsConfirmed).toBe(false);
    expect(useSessionStore.getState().selectedProducts).toEqual(['helix-core']);
  });
});

describe('setRole', () => {
  it('updates the role on the existing user', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().setRole('designer');
    expect(useSessionStore.getState().user?.role).toBe('designer');
  });

  it('no-ops when there is no user (returns empty partial state)', () => {
    const before = useSessionStore.getState();
    useSessionStore.getState().setRole('engineer');
    const after = useSessionStore.getState();
    expect(after.user).toBeNull();
    expect(after).toEqual(before);
  });

  it('preserves the rest of the user object on role change', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().setRole('engineer');
    const u = useSessionStore.getState().user!;
    expect(u.email).toBe(USER.email);
    expect(u.products).toEqual(USER.products);
  });
});

describe('setSelectedProducts', () => {
  it('replaces selectedProducts with the new ids', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().setSelectedProducts(['p4v']);
    expect(useSessionStore.getState().selectedProducts).toEqual(['p4v']);
  });

  it('accepts an empty selection', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().setSelectedProducts([]);
    expect(useSessionStore.getState().selectedProducts).toEqual([]);
  });
});

describe('confirmProducts', () => {
  it('sets productsConfirmed to true', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    expect(useSessionStore.getState().productsConfirmed).toBe(false);
    useSessionStore.getState().confirmProducts();
    expect(useSessionStore.getState().productsConfirmed).toBe(true);
  });

  it('is idempotent', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().confirmProducts();
    useSessionStore.getState().confirmProducts();
    expect(useSessionStore.getState().productsConfirmed).toBe(true);
  });
});

describe('setShape', () => {
  it.each(['explore', 'verify', 'trends'] as const)(
    'updates questionShape to %s',
    (shape) => {
      useSessionStore.getState().setShape(shape);
      expect(useSessionStore.getState().questionShape).toBe(shape);
    },
  );
});

describe('appendMessageToTab', () => {
  it('appends to an empty tab', () => {
    const { activeTabId } = useSessionStore.getState();
    const msg = makeMessage();
    useSessionStore.getState().appendMessageToTab(activeTabId, msg);
    expect(getActiveMessages()).toEqual([msg]);
  });

  it('preserves order when appending multiple messages', () => {
    const { activeTabId } = useSessionStore.getState();
    const a = makeMessage({ id: 'a' });
    const b = makeMessage({ id: 'b' });
    const c = makeMessage({ id: 'c' });
    useSessionStore.getState().appendMessageToTab(activeTabId, a);
    useSessionStore.getState().appendMessageToTab(activeTabId, b);
    useSessionStore.getState().appendMessageToTab(activeTabId, c);
    expect(getActiveMessages().map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the previous messages array (new reference)', () => {
    const { activeTabId } = useSessionStore.getState();
    const first = makeMessage({ id: '1' });
    useSessionStore.getState().appendMessageToTab(activeTabId, first);
    const refA = getActiveMessages();
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage({ id: '2' }));
    const refB = getActiveMessages();
    expect(refA).not.toBe(refB);
  });

  it('updates tab title from "New chat" on first user message', () => {
    const { activeTabId } = useSessionStore.getState();
    const msg = makeMessage({ role: 'user', text: 'What is the top pain point in P4V?' });
    useSessionStore.getState().appendMessageToTab(activeTabId, msg);
    const tab = useSessionStore.getState().tabs.find((t) => t.id === activeTabId)!;
    expect(tab.title).toBe('What is the top pain point in P4V?');
  });

  it('truncates tab title to 40 chars', () => {
    const { activeTabId } = useSessionStore.getState();
    const longText = 'A'.repeat(60);
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage({ role: 'user', text: longText }));
    const tab = useSessionStore.getState().tabs.find((t) => t.id === activeTabId)!;
    expect(tab.title).toHaveLength(40);
  });

  it('no-ops on an unknown tabId', () => {
    const before = useSessionStore.getState().tabs;
    useSessionStore.getState().appendMessageToTab('non-existent-id', makeMessage());
    expect(useSessionStore.getState().tabs).toEqual(before);
  });
});

describe('updateLastAssistantInTab', () => {
  it('no-ops when there is no assistant message in the tab', () => {
    const { activeTabId } = useSessionStore.getState();
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage({ id: 'u1', role: 'user' }));
    useSessionStore.getState().updateLastAssistantInTab(activeTabId, { text: 'changed' });
    const messages = getActiveMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]!.text).toBe('hi');
  });

  it('shallow-merges patch into the latest assistant message', () => {
    const { activeTabId } = useSessionStore.getState();
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage({ id: 'u1', role: 'user' }));
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage({ id: 'a1', role: 'assistant', text: 'partial' }));
    useSessionStore.getState().updateLastAssistantInTab(activeTabId, { text: 'final', citations: ['CL-0001'] });
    const messages = getActiveMessages();
    expect(messages[1]!.text).toBe('final');
    expect(messages[1]!.citations).toEqual(['CL-0001']);
    expect(messages[1]!.id).toBe('a1');
  });

  it('only updates the LATEST assistant message when multiple exist', () => {
    const { activeTabId } = useSessionStore.getState();
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage({ id: 'a1', role: 'assistant', text: 'old' }));
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage({ id: 'u1', role: 'user' }));
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage({ id: 'a2', role: 'assistant', text: 'mid' }));
    useSessionStore.getState().updateLastAssistantInTab(activeTabId, { text: 'latest' });
    const messages = getActiveMessages();
    expect(messages[0]!.text).toBe('old');
    expect(messages[2]!.text).toBe('latest');
  });

  it('supports updater-function form (used by stream-delta accumulator)', () => {
    const { activeTabId } = useSessionStore.getState();
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage({ id: 'a1', role: 'assistant', text: 'Hello' }));
    useSessionStore.getState().updateLastAssistantInTab(activeTabId, (m) => ({
      ...m,
      text: m.text + ' world',
    }));
    expect(getActiveMessages()[0]!.text).toBe('Hello world');
  });
});

describe('trimLastPhantomMessage', () => {
  it('removes a trailing empty assistant message', () => {
    const { activeTabId } = useSessionStore.getState();
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage({ id: 'u1', role: 'user' }));
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage({ id: 'phantom', role: 'assistant', text: '' }));
    useSessionStore.getState().trimLastPhantomMessage(activeTabId);
    const messages = getActiveMessages();
    expect(messages).toHaveLength(1);
    expect(messages.find((m) => m.id === 'phantom')).toBeUndefined();
  });

  it('does NOT remove a non-empty trailing assistant message', () => {
    const { activeTabId } = useSessionStore.getState();
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage({ id: 'a1', role: 'assistant', text: 'answer' }));
    useSessionStore.getState().trimLastPhantomMessage(activeTabId);
    expect(getActiveMessages()).toHaveLength(1);
  });

  it('does nothing when the tab is empty', () => {
    const { activeTabId } = useSessionStore.getState();
    useSessionStore.getState().trimLastPhantomMessage(activeTabId);
    expect(getActiveMessages()).toHaveLength(0);
  });
});

describe('reset', () => {
  it('returns to the pristine initial state', () => {
    const { activeTabId } = useSessionStore.getState();
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().confirmProducts();
    useSessionStore.getState().setShape('trends');
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage());
    useSessionStore.getState().reset();
    const s = useSessionStore.getState();
    expect(s.user).toBeNull();
    expect(s.availableProducts).toEqual([]);
    expect(s.selectedProducts).toEqual([]);
    expect(s.questionShape).toBe('explore');
    expect(s.loginComplete).toBe(false);
    expect(s.productsConfirmed).toBe(false);
    expect(getActiveMessages()).toEqual([]);
  });
});

describe('persistence (zustand persist middleware)', () => {
  it('serializes the partialized fields to localStorage', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().confirmProducts();
    useSessionStore.getState().setShape('verify');
    const raw = window.localStorage.getItem('grain.session');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.user.email).toBe(USER.email);
    expect(parsed.state.productsConfirmed).toBe(true);
    expect(parsed.state.questionShape).toBe('verify');
  });

  it('does NOT persist a top-level history field (messages live in tabs)', () => {
    const { activeTabId } = useSessionStore.getState();
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().appendMessageToTab(activeTabId, makeMessage({ id: 'msg' }));
    const raw = window.localStorage.getItem('grain.session');
    const parsed = JSON.parse(raw!);
    // history field must not exist at the top level
    expect(parsed.state.history).toBeUndefined();
    // messages must be in the tab
    const tab = parsed.state.tabs.find((t: { id: string }) => t.id === activeTabId);
    expect(tab?.messages).toHaveLength(1);
  });
});
