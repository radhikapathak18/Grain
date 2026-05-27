import type { QuestionShape } from '@grain/types';

export const SHAPE_DIRECTIVES: Record<QuestionShape, string> = {
  explore:
    'Surface themes. Lead with a one-sentence synthesis. Group findings by area. 3–5 themes max.',
  verify:
    'Answer the yes/no question first, in the first sentence. Then list the supporting evidence. State explicitly if evidence is weak or absent.',
  trends:
    "Order findings by recency. Use phrases like 'in recent months' only when claim dates support it. Note if signal is sparse.",
};

// Customer-segment / named-customer scoping directive. Applied on top of the
// shape directive whenever the question scopes to a customer segment or named
// customer (per architecture plan §3.8 walk-through of Q3). The synthesis
// prompt includes this clause verbatim so the model knows to filter by
// `evidence[].customer` at synthesis time rather than expecting retrieval to
// have done it.
export const CUSTOMER_SCOPE_DIRECTIVE = `If the question scopes to a customer segment (e.g., "AAA studios," "enterprise," "Fortune 500") or a named customer, filter the retrieved claims by inspecting each claim's evidence[].customer field BEFORE answering. Only synthesize from claims whose evidence contains a customer that fits the requested segment. If no retrieved claims match the requested segment, say so explicitly — do not fall back to all claims.`;
