// Unit tests for apps/web/src/hooks/useChatStream.ts.
//
// We mock global `fetch` and drive a ReadableStream byte-by-byte to
// exercise the SSE block parser inside the hook. The Zustand store is
// pre-seeded with a user/products so `send()` reaches the fetch path.
//
// Coverage targets (H-risk):
//   * SSE block parsing (split on \n\n; one block can span multiple raw chunks)
//   * Multi-event blocks (event: status, then event: delta, ...)
//   * Delta accumulation onto the last assistant message
//   * Citation dedupe — same id sent twice keeps just one
//   * Phantom empty-bubble cleanup before a new send
//   * abort/cancel — a second send() aborts the first
//   * `event: error` populates the error state

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useChatStream } from '../../../../apps/web/src/hooks/useChatStream.ts';
import { useSessionStore } from '../../../../apps/web/src/state/session.ts';
import type { Product, User } from '@grain/types';

const USER: User = {
  email: 'isathe@perforce.com',
  role: 'pm',
  products: ['helix-core', 'p4v'],
};
const PRODUCTS: Product[] = [
  { id: 'helix-core', displayName: 'Helix Core' },
  { id: 'p4v', displayName: 'P4V' },
];

// Build a controllable ReadableStream that exposes a `push(chunk)` and
// `close()`. The hook reads via res.body.getReader(), so this is the
// minimum surface area it needs.
function makeControlledBody() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    body: stream,
    push: (chunk: string) => controller.enqueue(encoder.encode(chunk)),
    close: () => controller.close(),
    error: (e: Error) => controller.error(e),
  };
}

function sseBlock(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Helper: get the active tab's messages from the store.
function getActiveTabMessages() {
  const { tabs, activeTabId } = useSessionStore.getState();
  return tabs.find((t) => t.id === activeTabId)?.messages ?? [];
}

beforeEach(() => {
  useSessionStore.getState().reset();
  useSessionStore.getState().setSession(USER, PRODUCTS);
  useSessionStore.getState().confirmProducts();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  useSessionStore.getState().reset();
});

function mockedFetch() {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

describe('useChatStream — happy path', () => {
  it('appends user + empty assistant messages on send()', async () => {
    const ctrl = makeControlledBody();
    mockedFetch().mockResolvedValueOnce(
      new Response(ctrl.body, { status: 200 }),
    );

    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));

    // Fire-and-forget; we'll resolve the stream below.
    act(() => {
      void result.current.send('what is the top pain point?');
    });

    // Two messages should have been appended synchronously inside send().
    const messages = getActiveTabMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe('user');
    expect(messages[0]!.text).toBe('what is the top pain point?');
    expect(messages[1]!.role).toBe('assistant');
    expect(messages[1]!.text).toBe('');

    // Resolve the stream so the hook unwinds cleanly.
    ctrl.push(sseBlock('done', { totalCitations: 0 }));
    ctrl.close();
    await waitFor(() => expect(result.current.streaming).toBe(false));
  });

  it('accumulates multiple delta events into the assistant text', async () => {
    const ctrl = makeControlledBody();
    mockedFetch().mockResolvedValueOnce(
      new Response(ctrl.body, { status: 200 }),
    );
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    act(() => void result.current.send('hello'));

    ctrl.push(sseBlock('delta', { text: 'Hello' }));
    ctrl.push(sseBlock('delta', { text: ', ' }));
    ctrl.push(sseBlock('delta', { text: 'world.' }));
    ctrl.push(sseBlock('done', { totalCitations: 0 }));
    ctrl.close();

    await waitFor(() => expect(result.current.streaming).toBe(false));
    const last = getActiveTabMessages().slice(-1)[0]!;
    expect(last.text).toBe('Hello, world.');
  });

  it('parses multiple events that arrive in a single byte chunk', async () => {
    const ctrl = makeControlledBody();
    mockedFetch().mockResolvedValueOnce(
      new Response(ctrl.body, { status: 200 }),
    );
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    act(() => void result.current.send('multi'));

    // All four events fused into one chunk.
    ctrl.push(
      sseBlock('status', { phase: 'searching', message: 'Searching…' }) +
        sseBlock('delta', { text: 'A.' }) +
        sseBlock('citation', { id: 'CL-0001' }) +
        sseBlock('done', { totalCitations: 1 }),
    );
    ctrl.close();

    await waitFor(() => expect(result.current.streaming).toBe(false));
    const last = getActiveTabMessages().slice(-1)[0]!;
    expect(last.text).toBe('A.');
    expect(last.citations).toEqual(['CL-0001']);
    expect(last.statuses).toHaveLength(1);
    expect(last.statuses![0]!.phase).toBe('searching');
  });

  it('reassembles a block split across raw byte chunks', async () => {
    const ctrl = makeControlledBody();
    mockedFetch().mockResolvedValueOnce(
      new Response(ctrl.body, { status: 200 }),
    );
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    act(() => void result.current.send('split'));

    const block = sseBlock('delta', { text: 'split-text' });
    const cut = Math.floor(block.length / 2);
    ctrl.push(block.slice(0, cut));
    ctrl.push(block.slice(cut));
    ctrl.push(sseBlock('done', { totalCitations: 0 }));
    ctrl.close();

    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(getActiveTabMessages().slice(-1)[0]!.text).toBe('split-text');
  });

  it('appends status events to the assistant message in order', async () => {
    const ctrl = makeControlledBody();
    mockedFetch().mockResolvedValueOnce(
      new Response(ctrl.body, { status: 200 }),
    );
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    act(() => void result.current.send('status'));

    ctrl.push(sseBlock('status', { phase: 'searching', message: 's' }));
    ctrl.push(sseBlock('status', { phase: 'retrieved', message: 'r' }));
    ctrl.push(sseBlock('status', { phase: 'synthesizing', message: 'y' }));
    ctrl.push(sseBlock('done', { totalCitations: 0 }));
    ctrl.close();

    await waitFor(() => expect(result.current.streaming).toBe(false));
    const last = getActiveTabMessages().slice(-1)[0]!;
    expect(last.statuses?.map((s) => s.phase)).toEqual([
      'searching',
      'retrieved',
      'synthesizing',
    ]);
  });
});

describe('useChatStream — citation dedupe', () => {
  it('only adds each citation id once even if the server sends duplicates', async () => {
    const ctrl = makeControlledBody();
    mockedFetch().mockResolvedValueOnce(
      new Response(ctrl.body, { status: 200 }),
    );
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    act(() => void result.current.send('cite'));

    ctrl.push(sseBlock('citation', { id: 'CL-0001' }));
    ctrl.push(sseBlock('citation', { id: 'CL-0002' }));
    ctrl.push(sseBlock('citation', { id: 'CL-0001' }));
    ctrl.push(sseBlock('citation', { id: 'CL-0002' }));
    ctrl.push(sseBlock('done', { totalCitations: 2 }));
    ctrl.close();

    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(getActiveTabMessages().slice(-1)[0]!.citations).toEqual([
      'CL-0001',
      'CL-0002',
    ]);
  });
});

describe('useChatStream — phantom empty bubble cleanup', () => {
  it('drops a trailing empty assistant message before appending the new pair', async () => {
    // Simulate the broken state left behind by an aborted previous send:
    // an empty assistant bubble at the tail of the active tab's messages.
    const { activeTabId, tabs } = useSessionStore.getState();
    useSessionStore.setState({
      tabs: tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              messages: [
                {
                  id: 'phantom-1',
                  role: 'assistant',
                  text: '',
                  createdAt: '2026-05-26T00:00:00Z',
                },
              ],
            }
          : t,
      ),
    });

    const ctrl = makeControlledBody();
    mockedFetch().mockResolvedValueOnce(
      new Response(ctrl.body, { status: 200 }),
    );
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    act(() => void result.current.send('next question'));

    // The phantom bubble should be GONE — new messages is just user +
    // fresh assistant.
    const messages = getActiveTabMessages();
    expect(messages.find((m) => m.id === 'phantom-1')).toBeUndefined();
    expect(messages).toHaveLength(2);

    ctrl.push(sseBlock('done', { totalCitations: 0 }));
    ctrl.close();
    await waitFor(() => expect(result.current.streaming).toBe(false));
  });

  it('does NOT drop a non-empty trailing assistant message', async () => {
    const { activeTabId, tabs } = useSessionStore.getState();
    useSessionStore.setState({
      tabs: tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              messages: [
                {
                  id: 'real-answer',
                  role: 'assistant',
                  text: 'previous answer',
                  createdAt: '2026-05-26T00:00:00Z',
                },
              ],
            }
          : t,
      ),
    });

    const ctrl = makeControlledBody();
    mockedFetch().mockResolvedValueOnce(
      new Response(ctrl.body, { status: 200 }),
    );
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    act(() => void result.current.send('next'));

    const messages = getActiveTabMessages();
    expect(messages.find((m) => m.id === 'real-answer')).toBeDefined();
    expect(messages).toHaveLength(3);

    ctrl.push(sseBlock('done', { totalCitations: 0 }));
    ctrl.close();
    await waitFor(() => expect(result.current.streaming).toBe(false));
  });
});

describe('useChatStream — error paths', () => {
  it('surfaces a stream error event as `error` state', async () => {
    const ctrl = makeControlledBody();
    mockedFetch().mockResolvedValueOnce(
      new Response(ctrl.body, { status: 200 }),
    );
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    act(() => void result.current.send('bad'));

    ctrl.push(sseBlock('error', { message: 'rate limited' }));
    ctrl.close();

    await waitFor(() => expect(result.current.error).toBe('rate limited'));
    expect(result.current.streaming).toBe(false);
  });

  it('falls back to "stream error" if the error event omits message', async () => {
    const ctrl = makeControlledBody();
    mockedFetch().mockResolvedValueOnce(
      new Response(ctrl.body, { status: 200 }),
    );
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    act(() => void result.current.send('bad'));

    ctrl.push('event: error\ndata: {}\n\n');
    ctrl.close();

    await waitFor(() => expect(result.current.error).toBe('stream error'));
  });

  it('reports a status-coded error when fetch resolves non-ok', async () => {
    mockedFetch().mockResolvedValueOnce(new Response('', { status: 500 }));
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));

    await act(async () => {
      await result.current.send('boom');
    });

    expect(result.current.error).toMatch(/stream open failed \(500\)/);
    expect(result.current.streaming).toBe(false);
  });

  it('returns early without firing fetch when there is no user', async () => {
    useSessionStore.getState().reset();
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    await act(async () => {
      await result.current.send('anything');
    });
    expect(mockedFetch()).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Not signed in');
  });

  it('does nothing on an empty/whitespace question', async () => {
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    await act(async () => {
      await result.current.send('   \t  ');
    });
    expect(mockedFetch()).not.toHaveBeenCalled();
    expect(getActiveTabMessages()).toHaveLength(0);
  });

  it('skips malformed data lines silently', async () => {
    const ctrl = makeControlledBody();
    mockedFetch().mockResolvedValueOnce(
      new Response(ctrl.body, { status: 200 }),
    );
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    act(() => void result.current.send('skip'));

    ctrl.push('event: delta\ndata: not-valid-json\n\n');
    ctrl.push(sseBlock('delta', { text: 'ok' }));
    ctrl.push(sseBlock('done', { totalCitations: 0 }));
    ctrl.close();

    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(getActiveTabMessages().slice(-1)[0]!.text).toBe('ok');
  });
});

describe('useChatStream — abort / cancel', () => {
  it('aborts the previous stream when send() is called again mid-stream', async () => {
    const first = makeControlledBody();
    const second = makeControlledBody();
    mockedFetch()
      .mockResolvedValueOnce(new Response(first.body, { status: 200 }))
      .mockResolvedValueOnce(new Response(second.body, { status: 200 }));

    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    act(() => void result.current.send('first'));

    // Yield to let the hook attach to the first stream.
    await new Promise<void>((r) => setTimeout(r, 5));

    // Fire the second send — should abort the first.
    act(() => void result.current.send('second'));

    // The signal on the first fetch call should now be aborted.
    const firstCall = mockedFetch().mock.calls[0]!;
    const firstSignal = (firstCall[1] as RequestInit).signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);

    second.push(sseBlock('delta', { text: 'second answer' }));
    second.push(sseBlock('done', { totalCitations: 0 }));
    second.close();

    await waitFor(() => expect(result.current.streaming).toBe(false));
    // Messages should reflect TWO user messages.
    const users = getActiveTabMessages().filter((m) => m.role === 'user');
    expect(users.map((u) => u.text)).toEqual(['first', 'second']);
  });

  it('reset() aborts the in-flight stream and clears error state', async () => {
    const ctrl = makeControlledBody();
    mockedFetch().mockResolvedValueOnce(
      new Response(ctrl.body, { status: 200 }),
    );
    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    act(() => void result.current.send('q'));
    await new Promise<void>((r) => setTimeout(r, 5));

    act(() => result.current.reset());

    expect(result.current.streaming).toBe(false);
    expect(result.current.error).toBeNull();
    const signal = (mockedFetch().mock.calls[0]![1] as RequestInit)
      .signal as AbortSignal;
    expect(signal.aborted).toBe(true);
    // Close the abandoned controller so the test doesn't leak.
    ctrl.close();
  });

  it('does not surface AbortError as a user-visible error', async () => {
    const ctrl = makeControlledBody();
    mockedFetch().mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          (init.signal as AbortSignal).addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const tabId = useSessionStore.getState().activeTabId;
    const { result } = renderHook(() => useChatStream(tabId));
    act(() => void result.current.send('first'));
    await new Promise<void>((r) => setTimeout(r, 5));

    act(() => result.current.reset());

    // Give the abort handler a tick to reject.
    await new Promise<void>((r) => setTimeout(r, 10));
    expect(result.current.error).toBeNull();
    ctrl.close();
  });
});
