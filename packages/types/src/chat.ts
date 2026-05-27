import type { ProductId, QuestionShape, Role } from './index.ts';

export type ChatRequest = {
  question: string;
  role: Role;
  products: ProductId[];
  shape: QuestionShape;
  history?: ChatMessage[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: string[];
  shape?: QuestionShape;
  asRole?: Role;
  createdAt: string;
};

export type ChatStreamEvent =
  | { event: 'delta'; data: { text: string } }
  | { event: 'citation'; data: { id: string } }
  | { event: 'done'; data: { totalCitations: number } }
  | { event: 'error'; data: { message: string } };
