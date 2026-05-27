// Helper: read an entire SSE response body and parse it into a typed
// list of events. Designed for the in-process `app.request(...)` style
// used by Hono — the Response body is a ReadableStream of UTF-8 bytes
// framed as SSE blocks (`event:` + `data:` lines separated by blank
// lines).
//
// Usage:
//   const events = await collectSSE(res);
//   const phases = events.filter(e => e.event === 'status').map(...);
//
// We intentionally consume the entire stream before parsing — these
// tests are not measuring latency, they assert event order and content
// across complete streams. For tests that need to assert mid-stream
// state (e.g. concurrency cap), use `streamSSE()` (below), which yields
// events as they arrive.

export type SSEEventRecord = {
  event: string;
  data: unknown;
  raw: string;
};

function parseBlock(block: string): SSEEventRecord | null {
  let event = 'message';
  let dataLines: string[] = [];
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
  return { event, data, raw };
}

/**
 * Read the full SSE body and return all events in order.
 * Returns [] if the response is not an SSE stream.
 */
export async function collectSSE(res: Response): Promise<SSEEventRecord[]> {
  const text = await res.text();
  if (!text) return [];
  const out: SSEEventRecord[] = [];
  const blocks = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const parsed = parseBlock(block);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * Async iterator over SSE events as they arrive on the body stream.
 * Useful when you need to assert state mid-stream (e.g. concurrency
 * cap: start one stream, while it's still pumping, kick off another
 * and verify it is rejected).
 */
export async function* streamSSE(res: Response): AsyncGenerator<SSEEventRecord> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    // Drain any complete blocks (separated by blank line).
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (!block) continue;
      const parsed = parseBlock(block);
      if (parsed) yield parsed;
    }
    if (done) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        const parsed = parseBlock(buffer.trim());
        if (parsed) yield parsed;
      }
      return;
    }
  }
}

/**
 * Convenience: return only the `event` names in arrival order.
 */
export function eventNames(events: SSEEventRecord[]): string[] {
  return events.map((e) => e.event);
}

/**
 * Convenience: filter events by name.
 */
export function eventsOfType(
  events: SSEEventRecord[],
  name: string,
): SSEEventRecord[] {
  return events.filter((e) => e.event === name);
}
