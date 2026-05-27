import { useState, type ReactNode } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { ROLE_LABELS, type ChatMessage, type StatusStep } from '@grain/types';
import { CitationChip } from './CitationChip';
import { CitationList } from './CitationList';
import { MessageActions } from './MessageActions';

type Props = {
  message: ChatMessage;
  isStreaming?: boolean;
  isLastAssistant?: boolean;
  userQuestion?: string | null;
  onRegenerate?: () => void;
};

function renderTextWithCitations(text: string): ReactNode[] {
  const parts = text.split(/(\[CL-\d{4}\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[CL-(\d{4})\]$/);
    if (m) return <CitationChip key={i} claimId={`CL-${m[1]}`} />;
    return <span key={i}>{part}</span>;
  });
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Status trail rendered above an assistant message.
 *
 * - While text hasn't started: full vertical list, last step pulses with a
 *   spinner.
 * - Once text begins (or streaming has ended): collapses to a single
 *   summary line ("✓ 3 steps") that's expandable via chevron.
 */
function StatusTrail({
  statuses,
  textStarted,
}: {
  statuses: StatusStep[];
  textStarted: boolean;
}) {
  const [forceExpanded, setForceExpanded] = useState(false);
  if (statuses.length === 0) return null;

  const collapsed = textStarted && !forceExpanded;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setForceExpanded(true)}
        className="mb-2 inline-flex items-center gap-1.5 text-xs text-subtle hover:text-muted transition-colors"
        aria-label="Show synthesis steps"
      >
        <Check size={12} className="text-tier-1" />
        <span>
          {statuses.length} step{statuses.length === 1 ? '' : 's'}
        </span>
        <ChevronDown size={12} />
      </button>
    );
  }

  return (
    <div className="mb-3 space-y-1.5">
      <ul className="space-y-1.5 text-xs text-muted">
        {statuses.map((step, i) => {
          const isLast = i === statuses.length - 1;
          const inProgress = isLast && !textStarted;
          return (
            <li key={i} className="flex items-start gap-2 leading-snug">
              <span className="mt-0.5 shrink-0" aria-hidden="true">
                {inProgress ? (
                  <Loader2 size={14} className="animate-spin text-accent" />
                ) : (
                  <Check size={14} className="text-tier-1" />
                )}
              </span>
              <span className={inProgress ? 'text-fg' : ''}>
                {step.message}
              </span>
            </li>
          );
        })}
      </ul>
      {textStarted && (
        <button
          type="button"
          onClick={() => setForceExpanded(false)}
          className="inline-flex items-center gap-1 text-[10px] text-subtle hover:text-muted"
        >
          <ChevronUp size={10} /> Collapse
        </button>
      )}
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div
      className="relative shrink-0 w-8 h-8 rounded-lg bg-accent text-accent-fg flex items-center justify-center grain-shadow-soft"
      aria-hidden="true"
    >
      <Sparkles size={14} strokeWidth={2.3} />
    </div>
  );
}

function UserAvatar({ initial }: { initial: string }) {
  return (
    <div
      className="shrink-0 w-8 h-8 rounded-lg bg-surface text-fg border border-border flex items-center justify-center font-semibold text-xs grain-shadow-soft"
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

export function MessageBubble({
  message,
  isStreaming = false,
  isLastAssistant = false,
  userQuestion = null,
  onRegenerate,
}: Props) {
  const isUser = message.role === 'user';
  const statuses = !isUser ? message.statuses ?? [] : [];
  const textStarted = message.text.length > 0;
  const showTyping = isStreaming && !textStarted && statuses.length === 0;
  const citations = !isUser ? message.citations ?? [] : [];
  const timestamp = formatTimestamp(message.createdAt);
  const userInitial = (message.asRole?.[0] ?? 'U').toUpperCase();

  // User bubbles: narrow cap so short messages don't stretch full width.
  // Assistant: wider cap because the answer is the main read.
  const bubbleWidth = isUser ? 'max-w-md' : 'max-w-[85%]';

  return (
    <div
      className={`flex w-full gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {isUser ? (
        <UserAvatar initial={userInitial} />
      ) : (
        <AssistantAvatar />
      )}

      <div
        className={`flex flex-col gap-1 ${
          isUser ? 'items-end' : 'items-start'
        } ${bubbleWidth}`}
      >
        {!isUser && message.asRole && (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold text-accent bg-accent-subtle/70 border border-accent/20"
            title="The role this answer was written for. Switch in the header to see the same evidence framed differently."
          >
            <span
              className="w-1 h-1 rounded-full bg-accent"
              aria-hidden="true"
            />
            Answered as {ROLE_LABELS[message.asRole]}
          </span>
        )}

        <div
          className={`rounded-2xl p-4 text-sm w-full transition-shadow ${
            isUser
              ? 'bg-accent-subtle/80 text-fg border border-accent/20 grain-shadow-soft'
              : 'bg-bg text-fg border border-border grain-shadow-card'
          }`}
        >
          {!isUser && statuses.length > 0 && (
            <StatusTrail statuses={statuses} textStarted={textStarted} />
          )}

          {showTyping ? (
            <span
              className="inline-flex items-center gap-1 text-muted"
              aria-label="Assistant is typing"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-muted motion-safe:animate-pulse" />
              <span
                className="w-1.5 h-1.5 rounded-full bg-muted motion-safe:animate-pulse"
                style={{ animationDelay: '120ms' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-muted motion-safe:animate-pulse"
                style={{ animationDelay: '240ms' }}
              />
            </span>
          ) : textStarted ? (
            <p className="whitespace-pre-wrap leading-relaxed">
              {isUser
                ? message.text
                : renderTextWithCitations(message.text)}
              {/* Blinking cursor at the end of streaming text. */}
              {!isUser && isStreaming && (
                <span
                  className="inline-block w-[2px] h-[1em] align-text-bottom ml-0.5 bg-accent motion-safe:animate-pulse"
                  aria-hidden="true"
                />
              )}
            </p>
          ) : null}
        </div>

        <div
          className={`flex items-center gap-3 px-1 text-[11px] text-subtle ${
            isUser ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          {timestamp && <span>{timestamp}</span>}
        </div>

        {!isUser && citations.length > 0 && (
          <CitationList citationIds={citations} />
        )}

        {!isUser && textStarted && !isStreaming && (
          <div className="w-full">
            <MessageActions
              message={message}
              citationIds={citations}
              question={userQuestion}
              isLastAssistant={isLastAssistant}
              onRegenerate={onRegenerate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
