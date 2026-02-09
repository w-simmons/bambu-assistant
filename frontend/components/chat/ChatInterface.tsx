'use client';

import { useChat } from '@/hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ModelViewer } from '@/components/model/ModelViewer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Image from 'next/image';

export function ChatInterface() {
  const {
    messages,
    currentJob,
    isLoading,
    error,
    sendMessage,
    refineModel,
    clearJob,
    clearError,
  } = useChat();

  const isGenerating = currentJob?.status === 'generating';
  const isPreviewReady = currentJob?.stage === 'preview' && currentJob?.status === 'succeeded';
  const isRefining = currentJob?.stage === 'refining' && currentJob?.status === 'generating';
  const isModelReady = currentJob?.stage === 'ready' && currentJob?.status === 'succeeded';

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

        {/* Preview Ready - Show thumbnail + Refine button */}
        {isPreviewReady && currentJob.thumbnailUrl && (
          <div className="border-t bg-muted/30 p-4">
            <div className="max-w-2xl mx-auto">
              <Card className="overflow-hidden">
                <div className="aspect-video relative bg-gray-100">
                  <Image
                    src={currentJob.thumbnailUrl}
                    alt={currentJob.prompt}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div className="p-4 border-t">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium">Preview: {currentJob.prompt}</p>
                      <p className="text-sm text-muted-foreground">
                        Quick preview ready! Refine for full print quality.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={clearJob}>
                        ✕ Discard
                      </Button>
                      <Button size="sm" onClick={refineModel}>
                        ✨ Refine for Print
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Full Model Ready - Show 3D viewer */}
        {isModelReady && currentJob.modelUrl && (
          <div className="border-t bg-muted/30 p-4">
            <div className="max-w-2xl mx-auto">
              <Card className="overflow-hidden">
                <div className="aspect-square relative">
                  <ModelViewer 
                    modelUrl={currentJob.modelUrl} 
                    thumbnailUrl={currentJob.thumbnailUrl || undefined}
                    className="w-full h-full" 
                  />
                </div>
                <div className="p-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{currentJob.prompt}</p>
                      <p className="text-sm text-muted-foreground">
                        Drag to rotate • Scroll to zoom
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearJob}>
                      New Model
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Generating indicator */}
        {(isGenerating || isRefining) && (
          <div className="border-t bg-muted/30 p-4">
            <div className="max-w-2xl mx-auto">
              <Card className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl animate-bounce">
                      {isRefining ? '✨' : '🎨'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {isRefining ? 'Refining' : 'Creating preview'}: {currentJob?.prompt}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isRefining 
                        ? 'Generating full detail model (~2 minutes)...'
                        : 'Quick preview (~10 seconds)...'
                      }
                    </p>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500 animate-pulse"
                        style={{ width: `${Math.max(currentJob?.progress || 0, 10)}%` }}
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
            disabled={isLoading || isGenerating || isRefining} 
            placeholder={isGenerating || isRefining
              ? 'Generating model...' 
              : 'Describe what you want to create...'
            }
          />
        </div>
      </div>
    </div>
  );
}
