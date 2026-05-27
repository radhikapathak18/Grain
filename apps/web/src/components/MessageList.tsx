import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@grain/types';
import { MessageBubble } from './MessageBubble';

type Props = {
  messages: ChatMessage[];
  streaming: boolean;
};

export function MessageList({ messages, streaming }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Watch latest assistant text length so streaming updates trigger scroll.
  const last = messages[messages.length - 1];
  const lastTextLen = last?.text.length ?? 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, lastTextLen, streaming]);

  if (messages.length === 0) return null;

  const lastIndex = messages.length - 1;

  return (
    <div className="flex-1 flex flex-col gap-4 py-4">
      {messages.map((m, i) => (
        <MessageBubble
          key={m.id}
          message={m}
          isStreaming={
            streaming && i === lastIndex && m.role === 'assistant'
          }
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
