import type { ReactNode } from 'react';
import type { ChatMessage } from '@grain/types';
import { CitationChip } from './CitationChip';
import { CitationCard } from './CitationCard';

type Props = {
  message: ChatMessage;
  isStreaming?: boolean;
};

function renderTextWithCitations(text: string): ReactNode[] {
  const parts = text.split(/(\[CL-\d{4}\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[CL-(\d{4})\]$/);
    if (m) return <CitationChip key={i} claimId={`CL-${m[1]}`} />;
    return <span key={i}>{part}</span>;
  });
}

export function MessageBubble({ message, isStreaming = false }: Props) {
  const isUser = message.role === 'user';
  const showTyping = isStreaming && !message.text;
  const citations = !isUser ? message.citations ?? [] : [];

  return (
    <div
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] flex flex-col ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={`rounded-lg p-4 text-sm shadow-sm ${
            isUser
              ? 'bg-accent-subtle text-fg border border-accent/20'
              : 'bg-surface text-fg border border-border'
          }`}
        >
          {showTyping ? (
            <span
              className="inline-flex items-center gap-1 text-muted"
              aria-label="Assistant is typing"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
              <span
                className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse"
                style={{ animationDelay: '120ms' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse"
                style={{ animationDelay: '240ms' }}
              />
            </span>
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">
              {isUser
                ? message.text
                : renderTextWithCitations(message.text)}
            </p>
          )}
        </div>

        {!isUser && citations.length > 0 && (
          <div className="mt-3 w-full flex flex-col gap-2">
            <span className="text-xs font-medium text-muted">
              Cited ({citations.length})
            </span>
            <div className="flex flex-col gap-2">
              {citations.map((id) => (
                <CitationCard key={id} claimId={id} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
