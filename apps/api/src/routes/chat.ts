// POST /api/chat/stream — Server-Sent Events synthesis endpoint.
//
// Flow:
//   1. Rate-limit + concurrency-cap per client IP (defense for an
//      unauthenticated endpoint that spawns subprocesses and burns
//      model tokens).
//   2. Validate the request (typed fields, bounded sizes).
//   3. Emit `status` events at three demo-visible moments so the user
//      sees what Grain is doing instead of a silent typing indicator.
//   4. Run deterministic retrieval (architecture plan §3.6 — role NOT
//      passed to retrieve so PM and Designer get the same claims).
//   5. Build the role+shape system prompt and stream Claude CLI output
//      as `delta` events. Citations are emitted progressively as the
//      model writes them, not in a single burst at the end.
//   6. Emit a terminal `done` event with the total citation count.
//
// Every accepted request is bracketed by chat.stream.start /
// chat.stream.end audit log lines so operators have an immutable record
// of who asked what.
//
// SECURITY: client-visible `error` event payloads are generic strings.
// Subprocess stderr, exit codes, and exception messages never reach the
// browser — they are logged through console.error with a stable prefix.

import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type {
  ChatRequest,
  Product,
  ProductId,
  StatusStep,
} from '@grain/types';
import { ROLES, QUESTION_SHAPES, PRODUCTS } from '@grain/types';
import { retrieve } from '../lib/retrieval.ts';
import { streamClaude } from '../lib/claude.ts';
import { buildSystemPrompt } from '../prompts/index.ts';
import { PRODUCT_BY_ID } from '../data/products.ts';
import { env } from '../env.ts';
import { audit } from '../lib/audit.ts';
import { checkRate, getClientIp } from '../lib/rateLimit.ts';
import {
  searchingStatus,
  retrievedStatus,
  synthesizingStatus,
} from '../lib/statusMessages.ts';

export const chatRoutes = new Hono();

const PRODUCT_SET = new Set<ProductId>(PRODUCTS);

// Caps on inbound payload. The question is written to subprocess stdin
// and inflates token spend, so the cap matters for both DoS and cost.
const MAX_QUESTION_CHARS = 2_000;
const MAX_PRODUCTS = PRODUCTS.length;

// Tiny delay between back-to-back status events so the user can read each
// one. Retrieval is sub-millisecond so without this the first two flash by
// invisibly. 250ms is enough to register, short enough to feel responsive.
// Deliberate UX latency — do not "optimize" away.
const STATUS_BEAT_MS = 250;
const beat = () => new Promise<void>((r) => setTimeout(r, STATUS_BEAT_MS));

// Width of the lookback window when scanning streamed text for [CL-NNNN]
// markers. A marker is 9 chars; 16 covers any marker that straddles a
// delta boundary with plenty of slack.
const CITATION_SCAN_OVERLAP = 16;
const CITATION_MARKER_RE = /\[CL-\d{4}\]/g;

const ERR_SYNTHESIS_FAILED = 'synthesis failed; please try again';
const ERR_INTERNAL = 'internal error';

type ValidatedRequest = {
  question: string;
  role: ChatRequest['role'];
  shape: ChatRequest['shape'];
  productIds: ProductId[];
  products: Product[];
};

type ValidationResult =
  | { ok: true; value: ValidatedRequest }
  | { ok: false; error: string };

function validate(body: Partial<ChatRequest> | null): ValidationResult {
  if (!body || typeof body.question !== 'string' || !body.question.trim()) {
    return { ok: false, error: 'question required' };
  }
  const question = body.question.trim();
  if (question.length > MAX_QUESTION_CHARS) {
    return {
      ok: false,
      error: `question must be ${MAX_QUESTION_CHARS} characters or fewer`,
    };
  }
  if (!body.role || !ROLES.includes(body.role)) {
    return { ok: false, error: 'invalid role' };
  }
  if (!body.shape || !QUESTION_SHAPES.includes(body.shape)) {
    return { ok: false, error: 'invalid shape' };
  }
  if (
    !Array.isArray(body.products) ||
    body.products.length === 0 ||
    body.products.length > MAX_PRODUCTS ||
    !body.products.every(
      (id): id is ProductId =>
        typeof id === 'string' && PRODUCT_SET.has(id as ProductId),
    )
  ) {
    return { ok: false, error: 'invalid products' };
  }
  // Dedupe while preserving first-seen order.
  const productIds = [...new Set(body.products)];
  const products = productIds
    .map((id) => PRODUCT_BY_ID[id])
    .filter((p): p is Product => Boolean(p));
  return {
    ok: true,
    value: { question, role: body.role, shape: body.shape, productIds, products },
  };
}

chatRoutes.post('/stream', async (c) => {
  const requestId = randomUUID();
  const ip = getClientIp(c);

  const rate = checkRate(ip);
  if (!rate.ok) {
    audit('chat.stream.rejected', { requestId, ip, reason: rate.reason });
    const headers: Record<string, string> = {};
    if (rate.reason === 'rate' && rate.retryAfterMs) {
      headers['Retry-After'] = String(Math.ceil(rate.retryAfterMs / 1000));
    }
    return c.json(
      {
        error:
          rate.reason === 'rate'
            ? 'rate limit exceeded'
            : 'too many concurrent requests',
      },
      429,
      headers,
    );
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    rate.release();
  };

  const body = (await c.req.json().catch(() => null)) as
    | Partial<ChatRequest>
    | null;
  const v = validate(body);
  if (!v.ok) {
    audit('chat.stream.invalid', { requestId, ip, reason: v.error });
    release();
    return c.json({ error: v.error }, 400);
  }
  const { question, role, shape, productIds, products } = v.value;

  audit('chat.stream.start', {
    requestId,
    ip,
    role,
    shape,
    productIds,
    questionChars: question.length,
    // Truncated preview keeps log lines bounded while preserving enough
    // text for audit reviewers to recognize the question.
    questionPreview: question.slice(0, 200),
  });
  const startedAt = Date.now();

  return streamSSE(c, async (stream) => {
    // Release concurrency slot immediately when client disconnects.
    // The release closure is idempotent — safe to call from both here and finally.
    stream.onAbort(release);

    const writeStatus = (step: StatusStep) =>
      stream.writeSSE({ event: 'status', data: JSON.stringify(step) });

    const cited = new Set<string>();
    let totalChars = 0;
    let claimsRetrieved = 0;
    let outcome: 'ok' | 'empty' | 'error' = 'error';
    let errorName: string | undefined;

    // Scan a window of streamed text and emit one `citation` event per
    // newly-seen marker. The dedupe Set means repeated scans are safe.
    const scanForCitations = async (window: string) => {
      const matches = window.matchAll(CITATION_MARKER_RE);
      for (const m of matches) {
        const id = m[0].slice(1, -1);
        if (cited.has(id)) continue;
        cited.add(id);
        await stream.writeSSE({
          event: 'citation',
          data: JSON.stringify({ id }),
        });
      }
    };

    try {
      // ── Status 1: searching
      await writeStatus(searchingStatus(products));
      await beat();

      // Deterministic retrieval — same claims regardless of role.
      const claims = retrieve(question, productIds, shape);
      claimsRetrieved = claims.length;

      // ── Status 2: retrieved
      await writeStatus(retrievedStatus(claims));

      // Early exit: nothing matched. Emit a polite delta so the assistant
      // bubble has visible content, then done.
      if (claims.length === 0) {
        const productNames = products.map((p) => p.displayName).join(', ');
        const emptyMessage =
          shape === 'verify'
            ? `No supporting evidence found across ${productNames}. There are no claims in the corpus that match this question — try broadening the products or rephrasing.`
            : `No matching research found across ${productNames}. Try a different question, or broaden the products you have selected from the header.`;
        await stream.writeSSE({
          event: 'delta',
          data: JSON.stringify({ text: emptyMessage }),
        });
        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({ totalCitations: 0 }),
        });
        outcome = 'empty';
        totalChars = emptyMessage.length;
        return;
      }

      await beat();

      // ── Status 3: synthesizing
      await writeStatus(synthesizingStatus(role));

      const systemPrompt = buildSystemPrompt({
        role,
        shape,
        products,
        claims,
      });

      // ── Stream the synthesis (progressive citation emission)
      let scanTail = '';
      for await (const ev of streamClaude({
        systemPrompt,
        userMessage: question,
        model: env.MODEL,
        requestId,
      })) {
        if (ev.kind === 'delta') {
          totalChars += ev.text.length;
          await stream.writeSSE({
            event: 'delta',
            data: JSON.stringify({ text: ev.text }),
          });
          const scanWindow = scanTail + ev.text;
          await scanForCitations(scanWindow);
          scanTail = scanWindow.slice(-CITATION_SCAN_OVERLAP);
        } else if (ev.kind === 'error') {
          // ev.message is already user-safe — claude.ts strips diagnostic
          // detail before pushing error events.
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({ message: ev.message }),
          });
        }
      }

      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ totalCitations: cited.size }),
      });
      outcome = 'ok';
    } catch (err) {
      console.error(
        `[chat] requestId=${requestId} stream error:`,
        err instanceof Error ? `${err.name}: ${err.message}` : err,
      );
      errorName = err instanceof Error ? err.name : 'unknown';
      try {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: ERR_SYNTHESIS_FAILED }),
        });
      } catch {
        // Client already disconnected — nothing to do.
      }
    } finally {
      audit('chat.stream.end', {
        requestId,
        outcome,
        claimsRetrieved,
        totalCitations: cited.size,
        responseChars: totalChars,
        durationMs: Date.now() - startedAt,
        ...(errorName ? { errorName } : {}),
      });
      release();
    }
  });
});

// Top-level safety net for routes that never reach the streamSSE handler
// (e.g. unexpected JSON parse failures slipped through). Hono otherwise
// returns a default 500 with a stack trace, which we do not want exposed.
chatRoutes.onError((err, c) => {
  console.error('[chat] unhandled error:', err);
  return c.json({ error: ERR_INTERNAL }, 500);
});
