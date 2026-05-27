import { Compass, ShieldCheck, TrendingUp } from 'lucide-react';
import {
  QUESTION_SHAPES,
  QUESTION_SHAPE_LABELS,
  type QuestionShape,
} from '@grain/types';
import { useSessionStore } from '../state/session';

const ICONS: Record<QuestionShape, typeof Compass> = {
  explore: Compass,
  verify: ShieldCheck,
  trends: TrendingUp,
};

export function QuestionShapeSelector() {
  const questionShape = useSessionStore((s) => s.questionShape);
  const setShape = useSessionStore((s) => s.setShape);

  return (
    <div
      role="tablist"
      aria-label="Question shape"
      className="inline-flex grain-glass rounded-full p-1 grain-shadow-soft"
    >
      {QUESTION_SHAPES.map((shape) => {
        const Icon = ICONS[shape];
        const active = shape === questionShape;
        return (
          <button
            key={shape}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => setShape(shape)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-accent/15 ${
              active
                ? 'bg-accent text-accent-fg grain-shadow-soft'
                : 'text-muted hover:text-fg'
            }`}
          >
            <Icon
              size={14}
              strokeWidth={active ? 2.4 : 2}
              aria-hidden="true"
            />
            {QUESTION_SHAPE_LABELS[shape]}
          </button>
        );
      })}
    </div>
  );
}
