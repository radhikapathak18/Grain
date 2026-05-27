// Keyword extraction for the `verify` shape retrieval filter.
//
// Lowercase the input, split on any non-alphanumeric run, drop stopwords,
// drop tokens shorter than 3 characters, dedupe, and return.
//
// This is deliberately tiny — the claims fixture is small enough that
// a stopword-stripped token-overlap filter is the entire retrieval system
// for verify-shape questions (see architecture plan §3.6).

const STOPWORDS = new Set<string>([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'could', 'should',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'about', 'as', 'that', 'this',
  'i', 'you', 'we', 'they', 'it', 'what', 'which', 'who', 'whom', 'where', 'when', 'why', 'how',
  'and', 'or', 'but', 'if', 'so', 'because', 'than', 'then', 'also', 'yes', 'no',
  'there', 'here', 'any', 'some', 'very', 'really', 'just', 'only', 'more', 'most', 'less', 'least',
  'evidence', 'question', 'find',
]);

const MIN_TOKEN_LENGTH = 3;

export function extractKeywords(text: string): string[] {
  const lowered = text.toLowerCase();
  const tokens = lowered.split(/[^a-z0-9]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    if (token.length < MIN_TOKEN_LENGTH) continue;
    if (STOPWORDS.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}
