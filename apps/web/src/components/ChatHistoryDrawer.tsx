import { useEffect, useState } from 'react';
import { Clock, SquarePen, Trash2, X } from 'lucide-react';
import { useSessionStore } from '../state/session';

type Props = {
  open: boolean;
  onClose: () => void;
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) {
    return 'Today';
  }
  if (date >= startOfYesterday) {
    return 'Yesterday';
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

export function ChatHistoryDrawer({ open, onClose }: Props) {
  const conversations = useSessionStore((s) => s.conversations);
  const activeConversationId = useSessionStore((s) => s.activeConversationId);
  const loadConversation = useSessionStore((s) => s.loadConversation);
  const deleteConversation = useSessionStore((s) => s.deleteConversation);
  const newChat = useSessionStore((s) => s.newChat);

  // `visible` tracks whether the panel is mounted; `slidIn` drives the transform.
  const [visible, setVisible] = useState(false);
  const [slidIn, setSlidIn] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      const raf = requestAnimationFrame(() => setSlidIn(true));
      return () => cancelAnimationFrame(raf);
    }
    setSlidIn(false);
    const t = window.setTimeout(() => setVisible(false), 200);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!visible) return null;

  function handleSelectConversation(id: string) {
    loadConversation(id);
    onClose();
  }

  function handleNewChat() {
    newChat();
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 bg-fg/25 backdrop-blur-[2px] z-40 transition-opacity duration-200 ${
          slidIn ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Chat history"
        aria-modal="true"
        className={`fixed left-0 top-0 h-full w-72 grain-glass-strong border-r border-border/60 grain-shadow-elevated z-50 flex flex-col motion-safe:transition-transform motion-safe:duration-300 [transition-timing-function:var(--ease-fluid)] ${
          slidIn ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-accent" aria-hidden="true" />
            <span className="text-sm font-semibold text-fg tracking-tight">
              Conversations
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat history"
            className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-fg transition-colors cursor-pointer focus:outline-none focus:ring-4 focus:ring-accent/15"
          >
            <X size={18} />
          </button>
        </header>

        {/* New Chat button */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-accent text-accent-fg text-sm font-medium hover:bg-accent-hover transition-colors cursor-pointer focus:outline-none focus:ring-4 focus:ring-accent/15 grain-shadow-soft"
          >
            <SquarePen size={14} aria-hidden="true" />
            New chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 grain-scroll">
          {conversations.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted leading-relaxed">
                No conversations yet. Ask a question to start building your history.
              </p>
            </div>
          ) : (
            <ul role="list" className="space-y-0.5">
              {conversations.map((convo) => (
                <li key={convo.id}>
                  <div
                    className={`group flex items-start gap-2 w-full px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                      activeConversationId === convo.id
                        ? 'bg-accent-subtle text-fg'
                        : 'hover:bg-surface text-muted hover:text-fg'
                    }`}
                    onClick={() => handleSelectConversation(convo.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectConversation(convo.id);
                      }
                    }}
                    aria-current={activeConversationId === convo.id ? 'true' : undefined}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-fg leading-snug">
                        {convo.title}
                      </p>
                      <p className="text-[11px] text-subtle mt-0.5">
                        {formatDate(convo.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(convo.id);
                      }}
                      aria-label={`Delete conversation: ${convo.title}`}
                      className="shrink-0 mt-0.5 p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 text-subtle hover:text-error transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
