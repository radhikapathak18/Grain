import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FileJson,
  FileText,
  LayoutDashboard,
  Presentation,
  RefreshCcw,
} from 'lucide-react';
import type { ChatMessage } from '@grain/types';
import { useClaims } from '../hooks/useClaims';
import {
  buildDeckHTML,
  buildJSON,
  buildMarkdown,
  copyText,
  downloadFile,
  makeFilename,
} from '../lib/export';

type Props = {
  message: ChatMessage;
  citationIds: string[];
  question: string | null;
  isLastAssistant: boolean;
  onRegenerate?: () => void;
};

export function MessageActions({
  message,
  citationIds,
  question,
  isLastAssistant,
  onRegenerate,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  // Hydrate claims for export when the menu opens; cheap because TanStack
  // Query already cached them when the citation cards rendered.
  const { data: claims } = useClaims(citationIds);

  useEffect(() => {
    if (!exportOpen) return;
    function onDocClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setExportOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [exportOpen]);

  async function handleCopy() {
    const ok = await copyText(message.text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  function payload() {
    return {
      message,
      claims: claims ?? [],
      question,
      role: message.asRole,
    };
  }

  function handleExportMarkdown() {
    const content = buildMarkdown(payload());
    downloadFile(content, makeFilename('grain', question, 'md'), 'text/markdown');
    setExportOpen(false);
  }

  function handleExportJSON() {
    const content = buildJSON(payload());
    downloadFile(content, makeFilename('grain', question, 'json'), 'application/json');
    setExportOpen(false);
  }

  function handleExportDeck() {
    const content = buildDeckHTML(payload());
    downloadFile(content, makeFilename('grain-deck', question, 'html'), 'text/html');
    setExportOpen(false);
  }

  return (
    <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-wider text-muted font-semibold mr-1">
        Next steps
      </span>

      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-bg hover:border-accent hover:text-accent transition-colors text-fg"
        aria-label="Copy answer"
      >
        {copied ? (
          <>
            <Check size={12} className="text-tier-1" /> Copied
          </>
        ) : (
          <>
            <Copy size={12} /> Copy
          </>
        )}
      </button>

      <div className="relative" ref={exportRef}>
        <button
          type="button"
          onClick={() => setExportOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={exportOpen}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-bg hover:border-accent hover:text-accent transition-colors text-fg"
        >
          <Download size={12} /> Export
          <ChevronDown size={12} className={exportOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        {exportOpen && (
          <div
            role="menu"
            className="absolute z-10 mt-1 min-w-[200px] bg-bg border border-border rounded-md shadow-md py-1"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleExportMarkdown}
              className="w-full text-left text-xs px-3 py-2 hover:bg-surface flex items-center gap-2 text-fg"
            >
              <FileText size={14} className="text-muted" />
              <span className="flex-1">Markdown</span>
              <span className="text-[10px] text-subtle">.md</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleExportJSON}
              className="w-full text-left text-xs px-3 py-2 hover:bg-surface flex items-center gap-2 text-fg"
            >
              <FileJson size={14} className="text-muted" />
              <span className="flex-1">JSON (claims + answer)</span>
              <span className="text-[10px] text-subtle">.json</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleExportDeck}
              className="w-full text-left text-xs px-3 py-2 hover:bg-surface flex items-center gap-2 text-fg"
            >
              <Presentation size={14} className="text-muted" />
              <span className="flex-1">Slide deck (HTML)</span>
              <span className="text-[10px] text-subtle">.html</span>
            </button>
          </div>
        )}
      </div>

      <Link
        to="/report"
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-bg hover:border-accent hover:text-accent transition-colors text-fg"
      >
        <LayoutDashboard size={12} /> Monthly report
      </Link>

      {isLastAssistant && onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          aria-label="Ask again"
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-bg hover:border-accent hover:text-accent transition-colors text-fg ml-auto"
        >
          <RefreshCcw size={12} /> Ask again
        </button>
      )}
    </div>
  );
}
