import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { CornerDownLeft, Send } from 'lucide-react';

type Props = {
  onSend: (text: string) => void;
  disabled: boolean;
};

export type MessageInputHandle = {
  focus: () => void;
};

export const MessageInput = forwardRef<MessageInputHandle, Props>(
  function MessageInput({ onSend, disabled }, ref) {
    const [value, setValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    // L2: ⌘K / Ctrl+K focuses the input from anywhere on the page.
    useEffect(() => {
      function onKey(e: globalThis.KeyboardEvent) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          textareaRef.current?.focus();
        }
      }
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);

    const trimmed = value.trim();
    const canSubmit = !disabled && trimmed.length > 0;

    function submit() {
      if (!canSubmit) return;
      onSend(trimmed);
      setValue('');
    }

    function handleSubmit(e: FormEvent<HTMLFormElement>) {
      e.preventDefault();
      submit();
    }

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    }

    return (
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border border-border rounded-2xl bg-bg p-2 grain-shadow-card focus-within:border-accent/40 focus-within:ring-4 focus-within:ring-accent/10 transition-all duration-150"
      >
        <textarea
          ref={textareaRef}
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask a question — e.g. What are the top pain points across Helix Core and P4V?"
          className="flex-1 px-3 py-2.5 resize-none text-fg bg-bg placeholder:text-subtle focus:outline-none disabled:cursor-not-allowed leading-relaxed min-h-[80px]"
        />

        {/* Inline hint replaces the floating "Press Enter…" paragraph. */}
        <div className="hidden sm:inline-flex items-center gap-1 px-2 pb-1 text-[10px] text-subtle">
          <kbd className="font-mono inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-surface/70 text-[10px] text-muted">
            <CornerDownLeft size={10} aria-hidden="true" />
          </kbd>
          send
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className={`p-2.5 rounded-xl text-accent-fg transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-accent/15 ${
            canSubmit
              ? 'bg-accent hover:bg-accent-hover active:scale-95 grain-shadow-soft cursor-pointer'
              : 'bg-surface text-subtle cursor-not-allowed'
          }`}
          aria-label="Send message"
        >
          <Send size={16} strokeWidth={2.3} />
        </button>
      </form>
    );
  },
);
