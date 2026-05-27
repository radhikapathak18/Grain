import type { ChatMessage, Claim, Role } from '@grain/types';
import { PRODUCT_LABELS, ROLE_LABELS } from '@grain/types';

type ExportPayload = {
  message: ChatMessage;
  claims: Claim[];
  question: string | null;
  role: Role | undefined;
};

function sanitizeFilenameSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'grain-export';
}

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function makeFilename(prefix: string, question: string | null, ext: string): string {
  const q = question ? sanitizeFilenameSlug(question) : 'grain';
  return `${prefix}-${q}-${timestampSlug()}.${ext}`;
}

export function buildMarkdown({ message, claims, question, role }: ExportPayload): string {
  const lines: string[] = [];
  lines.push('# Grain — Research Synthesis');
  lines.push('');
  if (question) lines.push(`> **Question:** ${question}`);
  if (role) lines.push(`> **Answered as:** ${ROLE_LABELS[role] ?? role}`);
  lines.push(`> **Generated:** ${new Date(message.createdAt).toLocaleString()}`);
  lines.push('');
  lines.push('## Answer');
  lines.push('');
  lines.push(message.text);
  lines.push('');
  if (claims.length > 0) {
    lines.push(`## Cited claims (${claims.length})`);
    lines.push('');
    for (const c of claims) {
      const product = PRODUCT_LABELS[c.product] ?? c.product;
      lines.push(`### ${c.id} — ${product}`);
      lines.push('');
      lines.push(`**Tier:** ${c.trust_tier}  ·  **Evidence:** ${c.evidence_count}  ·  **Most recent:** ${c.most_recent_evidence_at}`);
      lines.push('');
      lines.push(c.text);
      lines.push('');
      if (c.evidence.length > 0) {
        lines.push('**Evidence**');
        lines.push('');
        for (const ev of c.evidence.slice(0, 3)) {
          lines.push(`- _${ev.source_type}_${ev.customer ? ` · ${ev.customer}` : ''} · ${ev.source_date}`);
          lines.push(`  > ${ev.passage}`);
        }
        lines.push('');
      }
    }
  }
  return lines.join('\n');
}

export function buildJSON({ message, claims, question, role }: ExportPayload): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      question,
      role,
      shape: message.shape,
      answer: message.text,
      citationIds: message.citations ?? [],
      claims,
    },
    null,
    2,
  );
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Self-contained HTML slide deck. Arrow keys navigate. No external deps.
 * Each cited claim becomes a slide with evidence passages.
 */
export function buildDeckHTML({ message, claims, question, role }: ExportPayload): string {
  const slides: string[] = [];

  // Title slide
  slides.push(`
    <section class="slide title">
      <div class="kicker">Grain · Research synthesis</div>
      <h1>${question ? escapeHTML(question) : 'Research synthesis'}</h1>
      <div class="meta">
        ${role ? `Answered as <strong>${escapeHTML(ROLE_LABELS[role] ?? role)}</strong> · ` : ''}
        ${claims.length} cited claim${claims.length === 1 ? '' : 's'} ·
        ${new Date(message.createdAt).toLocaleString()}
      </div>
    </section>
  `);

  // Answer slide(s) — split paragraphs across slides so prose doesn't overflow.
  const paragraphs = message.text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0 && message.text.trim()) {
    paragraphs.push(message.text.trim());
  }
  slides.push(`
    <section class="slide answer">
      <h2>Synthesis</h2>
      ${paragraphs
        .map(
          (p) =>
            `<p>${escapeHTML(p).replace(/\[CL-(\d{4})\]/g, '<span class="cite">CL-$1</span>')}</p>`,
        )
        .join('\n')}
    </section>
  `);

  // One slide per cited claim
  for (const c of claims) {
    const product = PRODUCT_LABELS[c.product] ?? c.product;
    const firstEv = c.evidence[0];
    slides.push(`
      <section class="slide claim">
        <div class="kicker">
          <span class="pill tier-${c.trust_tier.toLowerCase()}">${c.trust_tier}</span>
          <span class="pill">${escapeHTML(c.id)}</span>
          <span class="meta-inline">${escapeHTML(product)}</span>
        </div>
        <h2>${escapeHTML(c.text)}</h2>
        ${
          firstEv
            ? `<blockquote>
                ${escapeHTML(firstEv.passage)}
                <footer>— ${escapeHTML(firstEv.source_type)}${firstEv.customer ? ` · ${escapeHTML(firstEv.customer)}` : ''} · ${escapeHTML(firstEv.source_date)}</footer>
              </blockquote>`
            : ''
        }
        <div class="meta">${c.evidence_count} evidence item${c.evidence_count === 1 ? '' : 's'} · most recent ${escapeHTML(c.most_recent_evidence_at)}</div>
      </section>
    `);
  }

  // Closing slide
  slides.push(`
    <section class="slide closing">
      <h2>Thank you</h2>
      <p class="meta">Generated by <strong>Grain</strong> · one interface over scattered product research.</p>
    </section>
  `);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Grain · ${question ? escapeHTML(question.slice(0, 80)) : 'Research deck'}</title>
<style>
  :root {
    --bg: #0d0d0f; --fg: #eaeaea; --muted: #888; --accent: #a78bfa;
    --tier-1: #34d399; --tier-2: #fbbf24; --tier-3: #f87171;
    --border: #2a2a2e;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg); color: var(--fg);
    -webkit-font-smoothing: antialiased;
  }
  .deck { height: 100vh; overflow: hidden; }
  .slide {
    display: none; padding: 8vh 10vw; height: 100vh;
    flex-direction: column; justify-content: center; gap: 1.5rem;
  }
  .slide.active { display: flex; }
  .slide h1 { font-size: 3rem; margin: 0; line-height: 1.15; font-weight: 600; }
  .slide h2 { font-size: 2rem; margin: 0; line-height: 1.25; font-weight: 600; }
  .slide p { font-size: 1.4rem; line-height: 1.55; margin: 0; }
  .slide.title h1 { font-size: 3.5rem; }
  .kicker {
    text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.85rem;
    color: var(--accent); font-weight: 500;
  }
  .meta, .meta-inline { color: var(--muted); font-size: 1rem; }
  .meta-inline { margin-left: 0.5rem; }
  .pill {
    display: inline-block; padding: 0.2rem 0.6rem; border: 1px solid var(--border);
    border-radius: 999px; font-family: ui-monospace, Menlo, monospace;
    font-size: 0.85rem; margin-right: 0.4rem;
  }
  .pill.tier-t1 { color: var(--tier-1); border-color: var(--tier-1); }
  .pill.tier-t2 { color: var(--tier-2); border-color: var(--tier-2); }
  .pill.tier-t3 { color: var(--tier-3); border-color: var(--tier-3); }
  .cite {
    color: var(--accent); font-family: ui-monospace, Menlo, monospace;
    font-size: 0.85em; padding: 0.05em 0.35em; border: 1px solid var(--accent);
    border-radius: 4px; margin: 0 0.1em;
  }
  blockquote {
    border-left: 3px solid var(--accent); padding: 0.5rem 1rem;
    margin: 0; font-style: italic; color: #cfcfcf;
  }
  blockquote footer { margin-top: 0.5rem; font-style: normal; font-size: 0.9rem; color: var(--muted); }
  .nav {
    position: fixed; bottom: 1rem; right: 1rem; left: 1rem;
    display: flex; justify-content: space-between; color: var(--muted); font-size: 0.85rem;
    pointer-events: none;
  }
  .nav .hint { pointer-events: auto; }
  @media print {
    .nav { display: none; }
    .slide { display: flex !important; page-break-after: always; height: auto; min-height: 100vh; }
  }
</style>
</head>
<body>
<div class="deck">
${slides.join('\n')}
</div>
<div class="nav">
  <span class="hint">← / → · Space · click to advance</span>
  <span id="pos">1 / N</span>
</div>
<script>
(function() {
  var slides = document.querySelectorAll('.slide');
  var pos = document.getElementById('pos');
  var idx = 0;
  function render() {
    slides.forEach(function(s, i) { s.classList.toggle('active', i === idx); });
    pos.textContent = (idx + 1) + ' / ' + slides.length;
  }
  function go(delta) {
    idx = Math.max(0, Math.min(slides.length - 1, idx + delta));
    render();
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { go(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(-1); e.preventDefault(); }
    else if (e.key === 'Home') { idx = 0; render(); }
    else if (e.key === 'End') { idx = slides.length - 1; render(); }
  });
  document.addEventListener('click', function() { go(1); });
  render();
})();
</script>
</body>
</html>`;
}

/**
 * CSV export — one row per evidence item (claims repeated across rows).
 * This "flat" shape opens cleanly in Excel / Google Sheets and supports
 * filtering by product, tier, source type, or customer without pivoting.
 */
export function buildCSV({ claims, question, role }: ExportPayload): string {
  const headers = [
    'claim_id',
    'product',
    'trust_tier',
    'sentiment',
    'area',
    'persona',
    'claim_text',
    'evidence_count',
    'most_recent_evidence_at',
    'source_id',
    'source_type',
    'source_date',
    'customer',
    'passage',
    'source_url',
  ];

  // RFC 4180-compliant cell escaping.
  function esc(val: string | number | undefined | null): string {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  const metaComment = [
    `# Grain export`,
    question ? `# Question: ${question}` : null,
    role ? `# Role: ${ROLE_LABELS[role] ?? role}` : null,
    `# Generated: ${new Date().toLocaleString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  const rows: string[] = [metaComment, headers.join(',')];

  if (claims.length === 0) {
    rows.push(headers.map((_, i) => (i === 0 ? esc('no-cited-claims') : '')).join(','));
  } else {
    for (const c of claims) {
      const product = PRODUCT_LABELS[c.product] ?? c.product;
      const baseFields = [
        esc(c.id),
        esc(product),
        esc(c.trust_tier),
        esc(c.sentiment),
        esc(c.area),
        esc(c.persona),
        esc(c.text),
        esc(c.evidence_count),
        esc(c.most_recent_evidence_at),
      ];
      if (c.evidence.length === 0) {
        rows.push([...baseFields, '', '', '', '', '', ''].join(','));
      } else {
        for (const ev of c.evidence) {
          rows.push(
            [
              ...baseFields,
              esc(ev.source_id),
              esc(ev.source_type),
              esc(ev.source_date),
              esc(ev.customer ?? ''),
              esc(ev.passage),
              esc(ev.source_url),
            ].join(','),
          );
        }
      }
    }
  }

  return rows.join('\n');
}

export function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after the click handler has had a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
