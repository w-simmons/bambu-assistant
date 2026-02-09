'use client';

import { useChat } from '@/hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ModelViewer } from '@/components/model/ModelViewer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function ChatInterface() {
  const {
    messages,
    currentJob,
    isLoading,
    error,
    sendMessage,
    cancelJob,
    clearError,
  } = useChat();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 bg-card">
        <h1 className="text-xl font-semibold">🖨️ Bambu Assistant</h1>
        <p className="text-sm text-muted-foreground">Describe what you want to create</p>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <MessageList messages={messages} isLoading={isLoading} />
        </div>

        {/* Model Preview - shows when model is ready */}
        {currentJob?.status === 'succeeded' && currentJob.modelUrl && (
          <div className="border-t bg-muted/30 p-4">
            <div className="max-w-2xl mx-auto">
              <Card className="overflow-hidden">
                <div className="aspect-square relative">
                  <ModelViewer modelUrl={currentJob.modelUrl} />
                </div>
                <div className="p-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{currentJob.prompt}</p>
                      <p className="text-sm text-muted-foreground">
                        Drag to rotate • Scroll to zoom
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={cancelJob}>
                      New Model
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Generating indicator */}
        {currentJob?.status === 'generating' && (
          <div className="border-t bg-muted/30 p-4">
            <div className="max-w-2xl mx-auto">
              <Card className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl animate-bounce">🎨</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Creating: {currentJob.prompt}</p>
                    <p className="text-sm text-muted-foreground">
                      This usually takes about 2 minutes...
                    </p>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500 animate-pulse"
                        style={{ width: `${Math.max(currentJob.progress, 10)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-card p-4">
        <div className="max-w-2xl mx-auto">
          <MessageInput 
            onSend={sendMessage} 
            disabled={isLoading || currentJob?.status === 'generating'} 
            placeholder={currentJob?.status === 'generating' 
              ? 'Generating model...' 
              : 'Describe what you want to create...'
            }
          />
        </div>
      </div>
    </div>
  );
}
