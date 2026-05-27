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
        className="flex items-end gap-2 border border-border rounded-lg bg-bg p-2 shadow-sm focus-within:border-border-strong transition-colors"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask anything — e.g. What are the top pain points across Helix Core and P4V?"
          className="flex-1 px-3 py-2 resize-none text-fg bg-bg placeholder:text-subtle focus:outline-none disabled:cursor-not-allowed leading-relaxed"
        />

        {/* Inline hint replaces the floating "Press Enter…" paragraph. */}
        <div className="hidden sm:inline-flex items-center gap-1 px-2 text-[10px] text-subtle">
          <CornerDownLeft size={11} aria-hidden="true" />
          send
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="p-2 rounded-md bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </form>
    );
  },
);
