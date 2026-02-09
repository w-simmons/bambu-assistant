'use client';

import { useChat } from '@/hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ModelCard } from '@/components/model/ModelCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function ChatInterface() {
  const {
    messages,
    currentJob,
    isLoading,
    error,
    sendMessage,
    confirmPrint,
    cancelJob,
    clearError,
  } = useChat();

  return (
    <div className="flex flex-col h-full">
      {/* Error Banner */}
      {error && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Messages */}
      <MessageList messages={messages} isLoading={isLoading} />

      {/* Current Job Preview */}
      {currentJob && currentJob.status === 'ready' && (
        <div className="border-t bg-muted/50 p-4">
          <div className="max-w-3xl mx-auto">
            <Card className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <ModelCard job={currentJob} className="flex-1" />
                
                <div className="flex flex-col gap-2 justify-center">
                  <Button onClick={confirmPrint} disabled={isLoading}>
                    🖨️ Print It!
                  </Button>
                  <Button variant="outline" onClick={cancelJob} disabled={isLoading}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Generating indicator */}
      {currentJob && currentJob.status === 'generating' && (
        <div className="border-t bg-muted/50 p-4">
          <div className="max-w-3xl mx-auto">
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl animate-pulse">🎨</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">Creating your model...</p>
                  <p className="text-sm text-muted-foreground">
                    This usually takes about 2 minutes
                  </p>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${currentJob.progress || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
