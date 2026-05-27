import type { MouseEvent } from 'react';
import {
  Phone,
  Video,
  MessageSquare,
  BarChart3,
  FileText,
  ExternalLink,
} from 'lucide-react';
import type { Evidence, SourceType } from '@grain/types';

type Props = {
  evidence: Evidence;
  onOpenSource: (sourceId: string, passage: string) => void;
};

const SOURCE_ICON: Record<SourceType, typeof Phone> = {
  gong: Phone,
  zoom: Video,
  slack: MessageSquare,
  pendo: BarChart3,
  confluence: FileText,
};

const SOURCE_LABEL: Record<SourceType, string> = {
  gong: 'Gong call',
  zoom: 'Zoom interview',
  slack: 'Slack message',
  pendo: 'Pendo signal',
  confluence: 'Confluence doc',
};

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const now = Date.now();
  const diffMs = now - then;
  const dayMs = 1000 * 60 * 60 * 24;
  const days = Math.floor(diffMs / dayMs);
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function EvidenceItem({ evidence, onOpenSource }: Props) {
  const Icon = SOURCE_ICON[evidence.source_type];
  const label = SOURCE_LABEL[evidence.source_type];

  const labelParts = [label];
  if (evidence.customer) labelParts.push(evidence.customer);
  labelParts.push(relativeDate(evidence.source_date));

  const handlePassageClick = (e: MouseEvent<HTMLQuoteElement>) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      onOpenSource(evidence.source_id, evidence.passage);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-md p-3 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5 text-muted">
          <Icon size={16} aria-hidden="true" />
        </div>
        <div className="text-xs text-muted leading-snug">
          {labelParts.join(' · ')}
        </div>
      </div>

      <blockquote
        onClick={handlePassageClick}
        title="Cmd/Ctrl+click to open full source"
        className="border-l-4 border-border-strong pl-3 italic text-sm text-fg leading-relaxed cursor-text"
      >
        {evidence.passage}
      </blockquote>

      <div>
        <button
          type="button"
          onClick={() => onOpenSource(evidence.source_id, evidence.passage)}
          className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover font-medium"
        >
          View full source
          <ExternalLink size={12} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
