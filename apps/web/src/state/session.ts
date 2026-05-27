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

type SessionState = {
  user: User | null;
  availableProducts: Product[];
  selectedProducts: ProductId[];
  questionShape: QuestionShape;

  loginComplete: boolean;
  productsConfirmed: boolean;

  history: ChatMessage[];

  setSession: (user: User, products: Product[]) => void;
  setRole: (role: Role) => void;
  setSelectedProducts: (ids: ProductId[]) => void;
  confirmProducts: () => void;
  setShape: (shape: QuestionShape) => void;
  appendMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (
    patch: Partial<ChatMessage> | ((m: ChatMessage) => ChatMessage),
  ) => void;
  clearHistory: () => void;
  reset: () => void;
};

const initial = {
  user: null,
  availableProducts: [],
  selectedProducts: [],
  questionShape: 'explore' as QuestionShape,
  loginComplete: false,
  productsConfirmed: false,
  history: [] as ChatMessage[],
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
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
      appendMessage: (message) =>
        set((s) => ({ history: [...s.history, message] })),
      updateLastAssistantMessage: (patch) =>
        set((s) => {
          const idx = (() => {
            for (let i = s.history.length - 1; i >= 0; i--) {
              if (s.history[i].role === 'assistant') return i;
            }
            return -1;
          })();
          if (idx === -1) return {};
          const prev = s.history[idx];
          const next =
            typeof patch === 'function'
              ? patch(prev)
              : { ...prev, ...patch };
          const history = s.history.slice();
          history[idx] = next;
          return { history };
        }),
      clearHistory: () => set({ history: [] }),
      reset: () => set({ ...initial }),
    }),
    {
      name: 'grain.session',
      version: 1,
      // Exclude `history` from persistence — fresh chat each session.
      partialize: (state) => ({
        user: state.user,
        availableProducts: state.availableProducts,
        selectedProducts: state.selectedProducts,
        questionShape: state.questionShape,
        loginComplete: state.loginComplete,
        productsConfirmed: state.productsConfirmed,
      }),
    },
  ),
);
