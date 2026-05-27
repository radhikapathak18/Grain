// POST /api/chat/stream — Server-Sent Events synthesis endpoint.
//
// Validates the chat request, runs deterministic retrieval (architecture
// plan §3.6 — role NOT passed to retrieve so PM and Designer get the
// same claims), builds the role+shape system prompt, then streams Claude
// CLI output as SSE deltas. After the model finishes, scan the assembled
// text for [CL-NNNN] markers and emit one `citation` event per unique
// id, followed by a terminal `done` event.

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { ChatRequest, ProductId, Product } from '@grain/types';
import { ROLES, QUESTION_SHAPES, PRODUCTS } from '@grain/types';
import { retrieve } from '../lib/retrieval.ts';
import { streamClaude } from '../lib/claude.ts';
import { buildSystemPrompt } from '../prompts/index.ts';
import { PRODUCT_BY_ID } from '../data/products.ts';
import { env } from '../env.ts';

export const chatRoutes = new Hono();

const PRODUCT_SET = new Set<ProductId>(PRODUCTS);

chatRoutes.post('/stream', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<ChatRequest> | null;

  if (!body || typeof body.question !== 'string' || !body.question.trim()) {
    return c.json({ error: 'question required' }, 400);
  }
  if (!body.role || !ROLES.includes(body.role)) {
    return c.json({ error: 'invalid role' }, 400);
  }
  if (!body.shape || !QUESTION_SHAPES.includes(body.shape)) {
    return c.json({ error: 'invalid shape' }, 400);
  }
  if (
    !Array.isArray(body.products) ||
    body.products.length === 0 ||
    !body.products.every((id): id is ProductId =>
      typeof id === 'string' && PRODUCT_SET.has(id as ProductId),
    )
  ) {
    return c.json({ error: 'invalid products' }, 400);
  }

  const question = body.question;
  const role = body.role;
  const shape = body.shape;
  const productIds = body.products;

  // Deterministic retrieval — same claims regardless of role.
  const claims = retrieve(question, productIds, shape);

  const products: Product[] = productIds
    .map((id) => PRODUCT_BY_ID[id])
    .filter((p): p is Product => Boolean(p));

  // Early exit: if no claims matched, do not call the LLM. Emit a polite
  // delta so the assistant bubble has content (otherwise it renders as a
  // phantom empty message), then close the stream.
  if (claims.length === 0) {
    const productNames = products.map((p) => p.displayName).join(', ');
    const emptyMessage =
      shape === 'verify'
        ? `No supporting evidence found across ${productNames}. There are no claims in the corpus that match this question — try broadening the products or rephrasing.`
        : `No matching research found across ${productNames}. Try a different question, or broaden the products you have selected from the header.`;
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: 'delta',
        data: JSON.stringify({ text: emptyMessage }),
      });
      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ totalCitations: 0 }),
      });
    });
  }

  const systemPrompt = buildSystemPrompt({
    role,
    shape,
    products,
    claims,
  });

  return streamSSE(c, async (stream) => {
    const cited = new Set<string>();
    let fullText = '';
    try {
      for await (const ev of streamClaude({
        systemPrompt,
        userMessage: question,
        model: env.MODEL,
      })) {
        if (ev.kind === 'delta') {
          fullText += ev.text;
          await stream.writeSSE({
            event: 'delta',
            data: JSON.stringify({ text: ev.text }),
          });
        } else if (ev.kind === 'error') {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({ message: ev.message }),
          });
        }
        // 'done' is implicit — the generator returns after yielding it.
      }

      // Post-stream pass: extract unique [CL-NNNN] citations in first-seen
      // order, emit one `citation` event per unique id (bare id, no brackets).
      const matches = fullText.matchAll(/\[CL-\d{4}\]/g);
      for (const m of matches) {
        const id = m[0].slice(1, -1);
        if (!cited.has(id)) {
          cited.add(id);
          await stream.writeSSE({
            event: 'citation',
            data: JSON.stringify({ id }),
          });
        }
      }

      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ totalCitations: cited.size }),
      });
    } catch (err) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          message: err instanceof Error ? err.message : String(err),
        }),
      });
    }
  });
});
