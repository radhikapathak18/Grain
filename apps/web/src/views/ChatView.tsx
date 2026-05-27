import { AlertCircle } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { QuestionShapeSelector } from '../components/QuestionShapeSelector';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';
import { EvidencePanel } from '../components/EvidencePanel';
import { useChatStream } from '../hooks/useChatStream';
import { useSessionStore } from '../state/session';

function EmptyHero() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
      <h2 className="text-xl font-semibold text-fg mb-2">
        Ask Grain anything about your research.
      </h2>
      <p className="text-muted text-sm max-w-md">
        Pick a question shape below, then type. Answers come with citations,
        trust signals, and product attribution baked in.
      </p>
    </div>
  );
}

export function ChatView() {
  const messages = useSessionStore((s) => s.history);
  const { send, streaming, error } = useChatStream();

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AppHeader />

      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-6 py-8">
        {messages.length === 0 ? (
          <EmptyHero />
        ) : (
          <MessageList messages={messages} streaming={streaming} />
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 mb-3 px-3 py-2 rounded-md border border-accent/40 bg-accent-subtle text-sm text-fg"
          >
            <AlertCircle size={16} className="mt-0.5 text-accent shrink-0" />
            <span>
              <span className="font-medium">Stream error.</span>{' '}
              <span className="text-muted">{error}</span>
            </span>
          </div>
        )}

        <div className="sticky bottom-0 bg-bg pt-3 space-y-3">
          <div className="flex justify-center">
            <QuestionShapeSelector />
          </div>
          <MessageInput onSend={send} disabled={streaming} />
          <p className="text-xs text-subtle text-center">
            Press Enter to send. Shift+Enter for a new line.
          </p>
        </div>
      </main>

      <EvidencePanel />
    </div>
  );
}
