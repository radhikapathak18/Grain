import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@grain/types';
import { MessageBubble } from './MessageBubble';

type Props = {
  messages: ChatMessage[];
  streaming: boolean;
  onRegenerate?: () => void;
};

// If the user is scrolled within this many pixels of the bottom, we count
// them as "following the stream" and keep auto-scrolling. Otherwise we
// leave them alone so they can re-read earlier text without being yanked.
const STICK_THRESHOLD_PX = 96;

export function MessageList({ messages, streaming, onRegenerate }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  const last = messages[messages.length - 1];
  const lastTextLen = last?.text.length ?? 0;
  const messageCount = messages.length;

  // Track whether the user is near the bottom of the page. Re-runs only on
  // user scroll, not on every streamed delta.
  useEffect(() => {
    function onScroll() {
      const distance =
        document.documentElement.scrollHeight -
        (window.scrollY + window.innerHeight);
      setStickToBottom(distance <= STICK_THRESHOLD_PX);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Always snap on a brand-new message; only follow text deltas if the
  // user hasn't scrolled away.
  useEffect(() => {
    if (!stickToBottom) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lastTextLen, streaming, stickToBottom]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setStickToBottom(true);
  }, [messageCount]);

  if (messages.length === 0) return null;

  // Find the index of the last assistant message so the regenerate
  // affordance shows only on the most recent answer.
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'assistant') {
      lastAssistantIdx = i;
      break;
    }
  }
  const lastIndex = messages.length - 1;

  return (
    <div className="flex-1 flex flex-col gap-4 py-4">
      {messages.map((m, i) => {
        const isLastMsg = i === lastIndex;
        const isLastAssistant = i === lastAssistantIdx;
        return (
          <MessageBubble
            key={m.id}
            message={m}
            isStreaming={
              streaming && isLastMsg && m.role === 'assistant'
            }
            isLastAssistant={isLastAssistant}
            onRegenerate={onRegenerate}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
