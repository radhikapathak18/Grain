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
    expect(s.history).toEqual([]);
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

describe('appendMessage', () => {
  it('appends to an empty history', () => {
    const msg = makeMessage();
    useSessionStore.getState().appendMessage(msg);
    expect(useSessionStore.getState().history).toEqual([msg]);
  });

  it('preserves order when appending multiple messages', () => {
    const a = makeMessage({ id: 'a' });
    const b = makeMessage({ id: 'b' });
    const c = makeMessage({ id: 'c' });
    useSessionStore.getState().appendMessage(a);
    useSessionStore.getState().appendMessage(b);
    useSessionStore.getState().appendMessage(c);
    expect(useSessionStore.getState().history.map((m) => m.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('does not mutate the previous history array (new reference)', () => {
    const first = makeMessage({ id: '1' });
    useSessionStore.getState().appendMessage(first);
    const refA = useSessionStore.getState().history;
    useSessionStore.getState().appendMessage(makeMessage({ id: '2' }));
    const refB = useSessionStore.getState().history;
    expect(refA).not.toBe(refB);
  });
});

describe('updateLastAssistantMessage', () => {
  it('no-ops when there is no assistant message', () => {
    useSessionStore.getState().appendMessage(makeMessage({ id: 'u1', role: 'user' }));
    useSessionStore.getState().updateLastAssistantMessage({ text: 'changed' });
    const h = useSessionStore.getState().history;
    expect(h).toHaveLength(1);
    expect(h[0]!.text).toBe('hi');
  });

  it('shallow-merges patch into the latest assistant message', () => {
    useSessionStore.getState().appendMessage(makeMessage({ id: 'u1', role: 'user' }));
    useSessionStore
      .getState()
      .appendMessage(makeMessage({ id: 'a1', role: 'assistant', text: 'partial' }));
    useSessionStore.getState().updateLastAssistantMessage({ text: 'final', citations: ['CL-0001'] });
    const h = useSessionStore.getState().history;
    expect(h[1]!.text).toBe('final');
    expect(h[1]!.citations).toEqual(['CL-0001']);
    expect(h[1]!.id).toBe('a1');
  });

  it('only updates the LATEST assistant message when multiple exist', () => {
    useSessionStore.getState().appendMessage(makeMessage({ id: 'a1', role: 'assistant', text: 'old' }));
    useSessionStore.getState().appendMessage(makeMessage({ id: 'u1', role: 'user' }));
    useSessionStore.getState().appendMessage(makeMessage({ id: 'a2', role: 'assistant', text: 'mid' }));
    useSessionStore.getState().updateLastAssistantMessage({ text: 'latest' });
    const h = useSessionStore.getState().history;
    expect(h[0]!.text).toBe('old');
    expect(h[2]!.text).toBe('latest');
  });

  it('supports updater-function form (used by stream-delta accumulator)', () => {
    useSessionStore
      .getState()
      .appendMessage(makeMessage({ id: 'a1', role: 'assistant', text: 'Hello' }));
    useSessionStore.getState().updateLastAssistantMessage((m) => ({
      ...m,
      text: m.text + ' world',
    }));
    expect(useSessionStore.getState().history[0]!.text).toBe('Hello world');
  });
});

describe('clearHistory', () => {
  it('removes all messages but keeps user/product state', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().confirmProducts();
    useSessionStore.getState().appendMessage(makeMessage());
    useSessionStore.getState().clearHistory();
    const s = useSessionStore.getState();
    expect(s.history).toEqual([]);
    expect(s.user).toEqual(USER);
    expect(s.productsConfirmed).toBe(true);
  });
});

describe('reset', () => {
  it('returns to the pristine initial state', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().confirmProducts();
    useSessionStore.getState().setShape('trends');
    useSessionStore.getState().appendMessage(makeMessage());
    useSessionStore.getState().reset();
    const s = useSessionStore.getState();
    expect(s.user).toBeNull();
    expect(s.availableProducts).toEqual([]);
    expect(s.selectedProducts).toEqual([]);
    expect(s.questionShape).toBe('explore');
    expect(s.loginComplete).toBe(false);
    expect(s.productsConfirmed).toBe(false);
    expect(s.history).toEqual([]);
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

  it('does NOT persist history (fresh chat each session)', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().appendMessage(makeMessage({ id: 'msg' }));
    const raw = window.localStorage.getItem('grain.session');
    const parsed = JSON.parse(raw!);
    expect(parsed.state.history).toBeUndefined();
  });
});
