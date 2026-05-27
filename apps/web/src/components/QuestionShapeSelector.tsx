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
      className="inline-flex bg-surface border border-border rounded-md p-1"
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              active
                ? 'bg-bg text-fg shadow-sm'
                : 'text-muted hover:text-fg'
            }`}
          >
            <Icon size={14} />
            {QUESTION_SHAPE_LABELS[shape]}
          </button>
        );
      })}
    </div>
  );
}
