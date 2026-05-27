import { useMemo, useRef } from 'react';
import {
  AlertCircle,
  Compass,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { QuestionShape } from '@grain/types';
import { AppHeader } from '../components/AppHeader';
import { QuestionShapeSelector } from '../components/QuestionShapeSelector';
import { MessageList } from '../components/MessageList';
import { MessageInput, type MessageInputHandle } from '../components/MessageInput';
import { EvidencePanel } from '../components/EvidencePanel';
import { useChatStream } from '../hooks/useChatStream';
import { useSessionStore } from '../state/session';
import { useEvidencePanelStore } from '../state/evidencePanel';

type ExamplePrompt = {
  shape: QuestionShape;
  icon: typeof Compass;
  label: string;
  text: string;
};

const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    shape: 'explore',
    icon: Compass,
    label: 'Explore',
    text: 'What are the top onboarding pain points in P4V?',
  },
  {
    shape: 'verify',
    icon: ShieldCheck,
    label: 'Verify',
    text: 'Is merge performance actually a top complaint in Helix Core?',
  },
  {
    shape: 'trends',
    icon: TrendingUp,
    label: 'See trends',
    text: 'How has CLI feedback shifted over the last 6 months?',
  },
];

function EmptyHero({
  onPick,
}: {
  onPick: (prompt: ExamplePrompt) => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12">
      <div className="w-14 h-14 rounded-2xl bg-accent text-accent-fg flex items-center justify-center grain-shadow-soft mb-6 grain-fade-up">
        <Sparkles size={24} strokeWidth={2.2} />
      </div>
      <h2 className="grain-display text-3xl sm:text-4xl font-semibold text-fg mb-3 max-w-2xl grain-fade-up grain-fade-up-delay-1">
        Ask Grain anything about your research.
      </h2>
      <p className="text-muted text-base max-w-lg mb-8 leading-relaxed grain-fade-up grain-fade-up-delay-2">
        Pick a question shape below, then type. Answers come with citations,
        trust signals, and product attribution baked in.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl w-full">
        {EXAMPLE_PROMPTS.map((p, i) => {
          const Icon = p.icon;
          return (
            <button
              key={p.shape}
              type="button"
              onClick={() => onPick(p)}
              style={{ animationDelay: `${200 + i * 80}ms` }}
              className="grain-fade-up group text-left p-4 rounded-xl border border-border bg-bg hover:border-accent/40 hover:bg-surface/40 hover:-translate-y-0.5 grain-shadow-soft hover:grain-shadow-card transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-accent/15"
            >
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-accent font-semibold mb-2">
                <Icon size={12} aria-hidden="true" />
                {p.label}
              </div>
              <div className="text-sm text-fg leading-snug group-hover:text-fg">
                {p.text}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FollowUpSuggestions({
  asRole,
  onPick,
}: {
  asRole: string | undefined;
  onPick: (q: string) => void;
}) {
  // Heuristic follow-ups — keyed off the most recent role. These are
  // intentionally generic so they land for any topic the user asked about.
  const suggestions = useMemo(() => {
    const base = [
      'Show only T1 (research-interview) evidence.',
      'What does this look like for the other products?',
    ];
    if (asRole === 'pm') {
      return [
        'Which of these has the strongest business impact?',
        ...base,
      ];
    }
    if (asRole === 'designer') {
      return ['Pull the most emotional verbatim quotes from above.', ...base];
    }
    if (asRole === 'engineer') {
      return ['Group these by likely subsystem / root cause.', ...base];
    }
    return ['Which findings have the weakest evidence?', ...base];
  }, [asRole]);

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-bg hover:border-accent hover:text-accent transition-colors text-muted"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function ChatView() {
  const messages = useSessionStore((s) => s.history);
  const setShape = useSessionStore((s) => s.setShape);
  const { send, streaming, error } = useChatStream();
  const inputRef = useRef<MessageInputHandle | null>(null);
  const panelOpen = useEvidencePanelStore((s) => Boolean(s.openClaimId));

  // The most-recent user message is what "Ask again" replays.
  const lastUserText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && m.role === 'user') return m.text;
    }
    return null;
  }, [messages]);

  function handleRegenerate() {
    if (lastUserText) send(lastUserText);
  }

  function handleStarter(question: string) {
    send(question);
    // Keep the textarea focused so the user can iterate quickly.
    inputRef.current?.focus();
  }

  function handleExamplePrompt(prompt: ExamplePrompt) {
    // Tagging the prompt with its shape demos the shape selector in one
    // motion — picking "Verify" sends a verify-shaped question.
    setShape(prompt.shape);
    send(prompt.text);
    inputRef.current?.focus();
  }

  const lastMessage = messages[messages.length - 1];
  const showFollowUps =
    !streaming &&
    !error &&
    lastMessage?.role === 'assistant' &&
    lastMessage.text.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AppHeader />

      {/* H2: shrink right padding so the chat shifts left when the panel opens. */}
      <main
        id="main"
        className={`flex-1 flex flex-col max-w-3xl w-full mx-auto px-6 py-8 transition-[padding,margin] duration-200 ${
          panelOpen ? 'lg:mr-[420px]' : ''
        }`}
      >
        {messages.length === 0 ? (
          <EmptyHero onPick={handleExamplePrompt} />
        ) : (
          <MessageList
            messages={messages}
            streaming={streaming}
            onRegenerate={handleRegenerate}
          />
        )}

        {showFollowUps && (
          <FollowUpSuggestions
            asRole={lastMessage?.asRole}
            onPick={handleStarter}
          />
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 my-3 px-3 py-2 rounded-md border border-error/40 bg-error-bg text-sm text-fg"
          >
            <AlertCircle size={16} className="mt-0.5 text-error shrink-0" />
            <span>
              <span className="font-medium">Stream error.</span>{' '}
              <span className="text-muted">{error}</span>
            </span>
          </div>
        )}

        <div className="sticky bottom-0 bg-bg pt-3 pb-2 space-y-2">
          <div className="flex justify-center">
            <QuestionShapeSelector />
          </div>
          <MessageInput ref={inputRef} onSend={send} disabled={streaming} />
        </div>
      </main>

      <EvidencePanel />
    </div>
  );
}
