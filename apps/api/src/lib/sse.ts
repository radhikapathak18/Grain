// SSE framing helper.
//
// Hono ships `streamSSE` from `hono/streaming` — chat.ts (Wave 2) uses that
// directly. This file just exports the typed event shape so the route code
// and the frontend can agree on the wire format.

import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

// Re-export for convenience so route code can import everything it needs
// from one place.
export { streamSSE };
export type { Context };

export type SSEEvent =
  | { event: 'delta'; data: { text: string } }
  | { event: 'citation'; data: { id: string } }
  | { event: 'done'; data: { totalCitations: number } }
  | { event: 'error'; data: { message: string } };

export function formatEvent(e: SSEEvent): { event: string; data: string } {
  return { event: e.event, data: JSON.stringify(e.data) };
}
