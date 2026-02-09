'use client';

import { useRef, useEffect } from 'react';
import { Message } from '@/hooks/useChat';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <div className="text-4xl">🦖</div>
          <p className="text-lg font-medium">Ready to create!</p>
          <p className="text-sm">Tell me what you want to make and I&apos;ll help you print it.</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4 max-w-3xl mx-auto">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {isLoading && (
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm">
              🤖
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3 items-start', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        {isUser ? '👤' : '🤖'}
      </div>
      
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-none'
            : 'bg-muted rounded-tl-none'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={cn(
            'text-xs mt-1',
            isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
