import type { ProductId, QuestionShape, Role } from './index.ts';

export type ChatRequest = {
  question: string;
  role: Role;
  products: ProductId[];
  shape: QuestionShape;
};

// One step in the "what is Grain doing right now" trail. The frontend
// renders these in order above the in-progress assistant bubble so users
// see plain-English progress instead of staring at a typing indicator.
export type StatusPhase =
  | 'searching'
  | 'retrieved'
  | 'synthesizing'
  | 'complete';

export type StatusStep = {
  phase: StatusPhase;
  message: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: string[];
  statuses?: StatusStep[];
  shape?: QuestionShape;
  asRole?: Role;
  createdAt: string;
};

export type ChatStreamEvent =
  | { event: 'status'; data: StatusStep }
  | { event: 'delta'; data: { text: string } }
  | { event: 'citation'; data: { id: string } }
  | { event: 'done'; data: { totalCitations: number } }
  | { event: 'error'; data: { message: string } };
