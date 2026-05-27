import type { Role, QuestionShape, Product, Claim } from '@grain/types';
import { ROLE_PROMPTS } from './roles/index.ts';
import { SHAPE_DIRECTIVES, CUSTOMER_SCOPE_DIRECTIVE } from './shapes.ts';

export type SynthesisInput = {
  role: Role;
  shape: QuestionShape;
  products: Product[];
  claims: Claim[];
};

// Slot 1 — Frame (static)
const FRAME_SLOT = `You are Grain, a research synthesis system for Perforce. You answer questions
by synthesizing pre-extracted claims from customer research. You never invent
facts. You always cite the claim ids you used.`;

// Slot 4 — Cross-product attribution rule (MANDATORY).
// {PRODUCTS_LIST} is substituted at build time from input.products.
function crossProductAttributionSlot(productsList: string): string {
  return `The user has selected these products: ${productsList}.

When two or more retrieved claims share the same \`area\` value but have different
\`product\` values, you MUST:
  - Name each product explicitly. Never write "users report X" without naming
    which product's users.
  - Use the structure: "In {product_A}, users report X [CL-####]. In {product_B},
    similar patterns appear as Y [CL-####]."
  - If the framing differs between products, acknowledge the difference.

If all claims for an area come from one product, name only that product. Do not
manufacture cross-product framing where none exists in the claims.`;
}

// Slot 5 — Trust calibration rule (MANDATORY). The §3.5 language map is
// embedded inline as a worked-example table so the model has the actual
// phrases for each tier rather than only the abstract instruction.
const TRUST_CALIBRATION_SLOT = `Each claim has a \`trust_tier\`: T1 (research interviews), T2 (sales calls, product
analytics), or T3 (internal chat, docs). Match your language to the weakest tier
you cite in a given sentence:
  - T1 only          → "Customers report ...", "Research surfaces ..."
  - T2 (or T1+T2)    → "Customers frequently mention ...", "Multiple users report ..."
  - T3 (or any mix)  → "Some users mention ...", "Anecdotal reports suggest ..."
Never exceed the confidence warranted by your weakest cited claim in a sentence.

Trust calibration language map — use these phrases, avoid the forbidden ones:

| Highest tier cited | Allowed lead-ins                                                     | Forbidden lead-ins                                       |
| ------------------ | -------------------------------------------------------------------- | -------------------------------------------------------- |
| T1 (Zoom research) | "Customers report", "Research interviews surface", "Users describe"  | "Some users", "Anecdotally"                              |
| T2 (Gong, Pendo)   | "Customers frequently mention", "Multiple users report", "Common feedback" | "Customers say definitively", "All users"          |
| T3 (Confluence, Slack) | "Some users mention", "Anecdotal reports suggest", "A few comments note" | "Customers report", "Users describe" (overclaims)   |

If a sentence cites a mix of tiers, calibrate to the WEAKEST tier in that
sentence — not the strongest.`;

// Slot 6 — Citation format rule (MANDATORY).
const CITATION_FORMAT_SLOT = `After every sentence that draws from a claim, append [CL-xxxx] for each supporting
claim. Multiple supporting claims: [CL-0007][CL-0012]. Never paraphrase a claim
without citing it. Never cite a claim id that does not appear in the retrieved
claims block below.`;

// Slot 8 — Response shape rule (static).
const RESPONSE_SHAPE_SLOT = `Lead with ONE synthesis sentence (no citations on this one). Then 3–5 paragraphs.
Keep total response under 250 words. Do not include section headers or markdown.`;

export function buildSystemPrompt(input: SynthesisInput): string {
  const productsList = input.products.map((p) => p.displayName).join(', ');

  // Slot 2 — Role block (dynamic, swaps between PM/Designer/Engineer/Researcher).
  const roleSlot = ROLE_PROMPTS[input.role];

  // Slot 3 — Shape directive (dynamic). Append the customer-scope directive
  // so the model knows how to handle segment-scoped questions (Q3 backup).
  const shapeSlot = `${SHAPE_DIRECTIVES[input.shape]}\n\n${CUSTOMER_SCOPE_DIRECTIVE}`;

  // Slot 4 — Cross-product attribution rule.
  const crossProductSlot = crossProductAttributionSlot(productsList);

  // Slot 7 — Retrieved claims block (the bulk of cached tokens).
  const claimsJson = JSON.stringify(input.claims, null, 2);
  const retrievedClaimsSlot = `<retrieved_claims>\n${claimsJson}\n</retrieved_claims>`;

  // Concatenate slots 1–8 in order with clear separators.
  return [
    FRAME_SLOT,
    roleSlot,
    shapeSlot,
    crossProductSlot,
    TRUST_CALIBRATION_SLOT,
    CITATION_FORMAT_SLOT,
    retrievedClaimsSlot,
    RESPONSE_SHAPE_SLOT,
  ].join('\n\n');
}
