import { Plus, X } from 'lucide-react';
import { useSessionStore } from '../state/session';

export function ChatTabBar() {
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const switchTab = useSessionStore((s) => s.switchTab);
  const closeTab = useSessionStore((s) => s.closeTab);
  const openNewTab = useSessionStore((s) => s.openNewTab);

  return (
    <div
      role="tablist"
      aria-label="Open chats"
      className="flex items-end gap-0.5 overflow-x-auto min-w-0 flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          aria-selected={activeTabId === tab.id}
          tabIndex={activeTabId === tab.id ? 0 : -1}
          onClick={() => switchTab(tab.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchTab(tab.id); }
          }}
          className={`group relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-x border-t transition-colors shrink-0 max-w-[160px] cursor-pointer select-none rounded-t-lg focus:outline-none focus:ring-2 focus:ring-accent/20 ${
            activeTabId === tab.id
              ? 'bg-bg border-border/60 text-fg shadow-sm'
              : 'bg-surface/60 border-border/40 text-muted hover:text-fg hover:bg-surface'
          }`}
        >
          <span className="truncate flex-1">{tab.title}</span>
          {tabs.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              aria-label={`Close tab: ${tab.title}`}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:bg-border text-subtle hover:text-fg transition-all cursor-pointer focus:outline-none"
            >
              <X size={11} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={openNewTab}
        aria-label="Open new chat tab"
        className="flex items-center justify-center w-7 h-7 mb-0.5 rounded-lg text-subtle hover:text-fg hover:bg-surface border border-transparent hover:border-border/40 transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-accent/20"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
