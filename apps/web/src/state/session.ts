import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ChatMessage,
  Product,
  ProductId,
  QuestionShape,
  Role,
  User,
} from '@grain/types';

type Conversation = {
  id: string;
  title: string;       // first user message, truncated to 60 chars
  createdAt: string;   // ISO timestamp
  messages: ChatMessage[];
};

type Tab = {
  id: string;
  title: string;
  conversationId: string | null;  // links to a persisted Conversation, or null
  messages: ChatMessage[];        // live message store for this tab
};

type SessionState = {
  user: User | null;
  availableProducts: Product[];
  selectedProducts: ProductId[];
  questionShape: QuestionShape;

  loginComplete: boolean;
  productsConfirmed: boolean;

  conversations: Conversation[];
  activeConversationId: string | null;

  tabs: Tab[];
  activeTabId: string;

  setSession: (user: User, products: Product[]) => void;
  setRole: (role: Role) => void;
  setSelectedProducts: (ids: ProductId[]) => void;
  confirmProducts: () => void;
  setShape: (shape: QuestionShape) => void;
  appendMessageToTab: (tabId: string, message: ChatMessage) => void;
  updateLastAssistantInTab: (
    tabId: string,
    patch: Partial<ChatMessage> | ((m: ChatMessage) => ChatMessage),
  ) => void;
  trimLastPhantomMessage: (tabId: string) => void;
  reset: () => void;

  newChat: () => void;
  openNewTab: () => void;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
};

const _defaultTabId = crypto.randomUUID();

const initial = {
  user: null,
  availableProducts: [],
  selectedProducts: [],
  questionShape: 'explore' as QuestionShape,
  loginComplete: false,
  productsConfirmed: false,
  conversations: [] as Conversation[],
  activeConversationId: null as string | null,
  tabs: [{ id: _defaultTabId, title: 'New chat', conversationId: null, messages: [] }] as Tab[],
  activeTabId: _defaultTabId,
};

function makeConversationFromHistory(
  history: ChatMessage[],
  existingId?: string,
): Conversation {
  // Trim any trailing incomplete assistant message (streaming was interrupted
  // before the response text arrived). Never persist a broken mid-stream state.
  const lastMsg = history[history.length - 1];
  const cleanHistory =
    lastMsg && lastMsg.role === 'assistant' && !lastMsg.text
      ? history.slice(0, -1)
      : history;

  const firstUserMsg = cleanHistory.find((m) => m.role === 'user' && m.text.trim().length > 0);
  const title = firstUserMsg
    ? firstUserMsg.text.slice(0, 60)
    : 'Untitled conversation';
  return {
    id: existingId ?? crypto.randomUUID(),
    title,
    createdAt: new Date().toISOString(),
    messages: cleanHistory,
  };
}

function hasUserMessage(history: ChatMessage[]): boolean {
  return history.some((m) => m.role === 'user' && m.text.trim().length > 0);
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      ...initial,
      setSession: (user, products) =>
        set({
          user,
          availableProducts: products,
          selectedProducts: user.products,
          loginComplete: true,
          productsConfirmed: false,
        }),
      setRole: (role) =>
        set((s) => (s.user ? { user: { ...s.user, role } } : {})),
      setSelectedProducts: (ids) => set({ selectedProducts: ids }),
      confirmProducts: () => set({ productsConfirmed: true }),
      setShape: (questionShape) => set({ questionShape }),

      appendMessageToTab: (tabId, message) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const newMessages = [...t.messages, message];
            let title = t.title;
            if (message.role === 'user' && t.title === 'New chat') {
              title = message.text.slice(0, 40);
            }
            return { ...t, messages: newMessages, title };
          }),
        })),

      updateLastAssistantInTab: (tabId, patch) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const idx = (() => {
              for (let i = t.messages.length - 1; i >= 0; i--) {
                if (t.messages[i]!.role === 'assistant') return i;
              }
              return -1;
            })();
            if (idx === -1) return t;
            const prev = t.messages[idx]!;
            const next =
              typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
            const messages = t.messages.slice();
            messages[idx] = next;
            return { ...t, messages };
          }),
        })),

      trimLastPhantomMessage: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const last = t.messages[t.messages.length - 1];
            if (last && last.role === 'assistant' && !last.text) {
              return { ...t, messages: t.messages.slice(0, -1) };
            }
            return t;
          }),
        })),

      reset: () => set({ ...initial }),

      openNewTab: () =>
        set((s) => {
          const currentTab = s.tabs.find((t) => t.id === s.activeTabId);
          const currentMessages = currentTab?.messages ?? [];
          const updatedConversations = [...s.conversations];
          if (hasUserMessage(currentMessages)) {
            const convo = makeConversationFromHistory(
              currentMessages,
              s.activeConversationId ?? undefined,
            );
            if (s.activeConversationId !== null) {
              const existingIdx = updatedConversations.findIndex(
                (c) => c.id === s.activeConversationId,
              );
              if (existingIdx !== -1) {
                updatedConversations[existingIdx] = convo;
              } else {
                updatedConversations.unshift(convo);
              }
            } else {
              updatedConversations.unshift(convo);
            }
          }
          const newTabId = crypto.randomUUID();
          const newTab: Tab = {
            id: newTabId,
            title: 'New chat',
            conversationId: null,
            messages: [],
          };
          return {
            tabs: [...s.tabs, newTab],
            activeTabId: newTabId,
            activeConversationId: null,
            conversations: updatedConversations,
          };
        }),

      newChat: () => get().openNewTab(),

      switchTab: (id: string) =>
        set((s) => {
          if (id === s.activeTabId) return {};
          return {
            activeTabId: id,
            activeConversationId: s.tabs.find((t) => t.id === id)?.conversationId ?? null,
          };
        }),

      closeTab: (id: string) =>
        set((s) => {
          if (s.tabs.length === 1) {
            return {
              tabs: [{ ...s.tabs[0]!, title: 'New chat', conversationId: null, messages: [] }],
              activeConversationId: null,
            };
          }
          const tabToClose = s.tabs.find((t) => t.id === id);
          const tabMessages = tabToClose?.messages ?? [];
          let updatedConversations = [...s.conversations];
          if (tabToClose && hasUserMessage(tabMessages)) {
            const convo = makeConversationFromHistory(tabMessages, tabToClose.conversationId ?? undefined);
            const existingIdx = updatedConversations.findIndex((c) => c.id === tabToClose.conversationId);
            if (existingIdx !== -1) {
              updatedConversations[existingIdx] = convo;
            } else {
              updatedConversations.unshift(convo);
            }
          }
          const remainingTabs = s.tabs.filter((t) => t.id !== id);
          if (id !== s.activeTabId) {
            return { tabs: remainingTabs, conversations: updatedConversations };
          }
          const closedIdx = s.tabs.findIndex((t) => t.id === id);
          const nextTab =
            remainingTabs[closedIdx] ??
            remainingTabs[closedIdx - 1] ??
            remainingTabs[0];
          return {
            tabs: remainingTabs,
            activeTabId: nextTab!.id,
            activeConversationId: nextTab!.conversationId,
            conversations: updatedConversations,
          };
        }),

      loadConversation: (id: string) =>
        set((s) => {
          // If this conversation is already open in a tab, switch to it.
          const existingTab = s.tabs.find((t) => t.conversationId === id);
          if (existingTab) {
            if (existingTab.id === s.activeTabId) return {};
            return {
              activeTabId: existingTab.id,
              activeConversationId: id,
            };
          }
          // Open conversation in a new tab.
          const target = s.conversations.find((c) => c.id === id);
          if (!target) return {};
          const newTabId = crypto.randomUUID();
          const newTab: Tab = {
            id: newTabId,
            title: target.title,
            conversationId: id,
            messages: target.messages,
          };
          return {
            tabs: [...s.tabs, newTab],
            activeTabId: newTabId,
            activeConversationId: id,
          };
        }),

      deleteConversation: (id: string) =>
        set((s) => {
          const state: Partial<SessionState> = {
            conversations: s.conversations.filter((c) => c.id !== id),
          };
          if (s.activeConversationId === id) {
            state.activeConversationId = null;
          }
          return state;
        }),
    }),
    {
      name: 'grain.session',
      version: 3,
      storage: {
        getItem: (name) => {
          const value = localStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (err) {
            console.warn('[grain.session] localStorage.setItem failed — storage may be full.', err);
          }
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
      onRehydrateStorage: () => (_, err) => {
        if (err) {
          console.warn('[grain.session] Failed to rehydrate persisted state.', err);
        }
      },
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0) {
          // v0 predates the version field — state structure is unknown and may
          // be corrupt. Return a clean initial state to avoid loading bad data.
          return { loginComplete: false, productsConfirmed: false };
        }
        if (version === 1) {
          // v1 had no tabs/activeTabId/history — return as-is; missing fields
          // will merge with initial state automatically via zustand's default merge.
          return persistedState as Partial<SessionState>;
        }
        if (version === 2) {
          // v2 stored active tab messages in a top-level `history` field.
          // Move them into the active tab's messages array.
          const s = persistedState as {
            history?: ChatMessage[];
            tabs?: Tab[];
            activeTabId?: string;
          };
          if (s.history && s.tabs && s.activeTabId) {
            return {
              ...(persistedState as object),
              tabs: s.tabs.map((t) =>
                t.id === s.activeTabId ? { ...t, messages: s.history! } : t,
              ),
              // history field is gone in v3
            } as Partial<SessionState>;
          }
          return persistedState as Partial<SessionState>;
        }
        return persistedState as Partial<SessionState>;
      },
      partialize: (state) => ({
        user: state.user,
        availableProducts: state.availableProducts,
        selectedProducts: state.selectedProducts,
        questionShape: state.questionShape,
        loginComplete: state.loginComplete,
        productsConfirmed: state.productsConfirmed,
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        // history removed — messages now live in tabs[].messages
      }),
    },
  ),
);
