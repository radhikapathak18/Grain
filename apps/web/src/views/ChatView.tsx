import { useState } from 'react';
import { Clock, SquarePen } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { ChatTabBar } from '../components/ChatTabBar';
import { ChatPane } from '../components/ChatPane';
import { EvidencePanel } from '../components/EvidencePanel';
import { ChatHistoryDrawer } from '../components/ChatHistoryDrawer';
import { useSessionStore } from '../state/session';

export function ChatView() {
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const openNewTab = useSessionStore((s) => s.openNewTab);
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AppHeader />

      {/* Chat sub-header: tab bar (left) + New Chat + History (right) */}
      <div className="sticky top-14 z-20 border-b border-border/60 bg-bg/95 backdrop-blur-sm flex items-stretch gap-2 px-4">
        <ChatTabBar />
        <div className="flex items-center gap-1 py-1.5 shrink-0 border-l border-border/40 pl-3 ml-1">
          <button
            type="button"
            onClick={openNewTab}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-fg hover:bg-surface border border-transparent hover:border-border/40 transition-colors cursor-pointer focus:outline-none focus:ring-4 focus:ring-accent/15"
          >
            <SquarePen size={13} aria-hidden="true" />
            New chat
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-fg hover:bg-surface border border-transparent hover:border-border/40 transition-colors cursor-pointer focus:outline-none focus:ring-4 focus:ring-accent/15"
          >
            <Clock size={13} aria-hidden="true" />
            History
          </button>
        </div>
      </div>

      {/* Main content — one pane per tab, only the active one is shown */}
      <main id="main" className="flex-1 flex flex-col">
        {tabs.map((tab) => (
          <ChatPane
            key={tab.id}
            tabId={tab.id}
            isActive={tab.id === activeTabId}
          />
        ))}
      </main>

      <EvidencePanel />
      <ChatHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
