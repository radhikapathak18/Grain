// Browser-equivalent SSE reader used by the realtime suite.
//
// The Grain frontend (`apps/web/src/hooks/useChatStream.ts`) does NOT use
// the EventSource API — it uses `fetch` + `response.body.getReader()`,
// because EventSource cannot POST a JSON body. This file mirrors that
// exact parsing approach so the realtime tests exercise the same wire
// contract the production client does.
//
// The reader yields one event at a time, each tagged with an arrival
// timestamp (`tHighResMs`) so the timing tests can assert the gap
// between consecutive status events without having to time-stamp them
// at the call-site.

export type RealtimeEvent = {
  event: string;
  data: unknown;
  raw: string;
  /** Monotonic high-resolution time (ms) when the event was fully parsed. */
  tHighResMs: number;
};

function parseBlock(block: string, tHighResMs: number): RealtimeEvent | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (event === 'message' && dataLines.length === 0) return null;
  const raw = dataLines.join('\n');
  let data: unknown = raw;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
  return { event, data, raw, tHighResMs };
}

export type ReadOptions = {
  /**
   * Optional async hook invoked after each `reader.read()`. Useful to
   * simulate a slow consumer (`await new Promise(r => setTimeout(r, 50))`).
   */
  betweenReads?: (chunkIndex: number) => Promise<void> | void;
};

/**
 * Async iterator over SSE events as they arrive on a Response body.
 * Matches the production frontend's parsing exactly (split on `\n\n`,
 * recognize `event:` and `data:` lines).
 */
export async function* readSSE(
  res: Response,
  opts: ReadOptions = {},
): AsyncGenerator<RealtimeEvent> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let chunkIndex = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (opts.betweenReads) {
        await opts.betweenReads(chunkIndex);
      }
      chunkIndex += 1;
      if (value) buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!block) continue;
        const parsed = parseBlock(block, performance.now());
        if (parsed) yield parsed;
      }

      if (done) {
        buffer += decoder.decode();
        const tail = buffer.trim();
        if (tail) {
          const parsed = parseBlock(tail, performance.now());
          if (parsed) yield parsed;
        }
        return;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // already released or stream errored — nothing to do
    }
  }
}

/** Convenience: drain an SSE response into an array, in order. */
export async function collectSSE(
  res: Response,
  opts: ReadOptions = {},
): Promise<RealtimeEvent[]> {
  const out: RealtimeEvent[] = [];
  for await (const ev of readSSE(res, opts)) {
    out.push(ev);
  }
  return out;
}
