import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

type Props = {
  onSend: (text: string) => void;
  disabled: boolean;
};

export function MessageInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');

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
      className="flex items-end gap-2 border border-border rounded-lg bg-bg p-2 shadow-sm focus-within:border-border-strong"
    >
      <textarea
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="e.g. What are the top pain points across Helix Core and P4V?"
        className="flex-1 px-3 py-2 resize-none text-fg bg-bg placeholder:text-subtle focus:outline-none disabled:cursor-not-allowed leading-relaxed"
      />
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
}
