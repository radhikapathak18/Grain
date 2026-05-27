import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, StatusStep } from '@grain/types';
import { useSessionStore } from '../state/session';

type StreamEventName =
  | 'status'
  | 'delta'
  | 'citation'
  | 'done'
  | 'error'
  | 'message';

function makeId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type UseChatStreamResult = {
  send: (question: string) => Promise<void>;
  streaming: boolean;
  error: string | null;
  reset: () => void;
};

export function useChatStream(tabId: string): UseChatStreamResult {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setError(null);
  }, []);

  const send = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    // Cancel any in-flight stream.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Drop any phantom trailing empty assistant message from a previous
    // aborted/errored send. Without this, double-clicking send or a 400
    // response leaves an empty bubble that never gets populated.
    useSessionStore.getState().trimLastPhantomMessage(tabId);

    const store = useSessionStore.getState();
    const { user, selectedProducts, questionShape } = store;
    if (!user) {
      setError('Not signed in');
      return;
    }

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: makeId(),
      role: 'user',
      text: trimmed,
      createdAt: now,
      shape: questionShape,
      asRole: user.role,
    };
    const assistantMessage: ChatMessage = {
      id: makeId(),
      role: 'assistant',
      text: '',
      citations: [],
      statuses: [],
      createdAt: new Date().toISOString(),
      shape: questionShape,
      asRole: user.role,
    };

    store.appendMessageToTab(tabId, userMessage);
    store.appendMessageToTab(tabId, assistantMessage);

    setError(null);
    setStreaming(true);

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'text/event-stream',
        },
        body: JSON.stringify({
          question: trimmed,
          role: user.role,
          products: selectedProducts,
          shape: questionShape,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`stream open failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamErrored = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          if (!block.trim()) continue;
          let eventName: StreamEventName = 'message';
          let dataStr = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim() as StreamEventName;
            } else if (line.startsWith('data:')) {
              dataStr += line.slice(5).trim();
            }
          }
          if (!dataStr) continue;

          let data: unknown;
          try {
            data = JSON.parse(dataStr);
          } catch {
            continue;
          }

          if (eventName === 'status') {
            const step = data as StatusStep | null;
            if (step && step.message) {
              useSessionStore.getState().updateLastAssistantInTab(tabId, (m) => {
                const existing = m.statuses ?? [];
                return { ...m, statuses: [...existing, step] };
              });
            }
          } else if (eventName === 'delta') {
            const text = (data as { text?: string } | null)?.text ?? '';
            if (text) {
              useSessionStore.getState().updateLastAssistantInTab(tabId, (m) => ({
                ...m,
                text: m.text + text,
              }));
            }
          } else if (eventName === 'citation') {
            const id = (data as { id?: string } | null)?.id;
            if (id) {
              useSessionStore.getState().updateLastAssistantInTab(tabId, (m) => {
                const existing = m.citations ?? [];
                if (existing.includes(id)) return m;
                return { ...m, citations: [...existing, id] };
              });
            }
          } else if (eventName === 'done') {
            // graceful close; let the loop exit naturally on reader done.
          } else if (eventName === 'error') {
            const msg =
              (data as { message?: string } | null)?.message ??
              'stream error';
            setError(msg);
            streamErrored = true;
          }
        }
      }

      if (!streamErrored) {
        setError(null);
      }
    } catch (err: unknown) {
      if ((err as { name?: string } | null)?.name === 'AbortError') {
        // intentional cancel from a follow-up send() — don't surface
      } else {
        const message =
          err instanceof Error ? err.message : 'unexpected stream error';
        setError(message);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setStreaming(false);
      }
    }
  }, [tabId]);

  return { send, streaming, error, reset };
}
