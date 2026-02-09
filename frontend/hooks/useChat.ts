'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export type JobStage = 'preview' | 'refining' | 'ready';

export interface ModelJob {
  taskId: string;
  stage: JobStage;
  status: 'generating' | 'succeeded' | 'failed';
  progress: number;
  modelUrl: string | null;
  thumbnailUrl: string | null;
  prompt: string;
  previewTaskId?: string;  // For refine step
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your 3D printing assistant. Tell me what you'd like to create - I'll show you a quick preview first, then you can refine it to full detail for printing!",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [currentJob, setCurrentJob] = useState<ModelJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Poll for job status
  useEffect(() => {
    if (currentJob?.taskId && currentJob.status === 'generating') {
      pollInterval.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/status/${currentJob.taskId}`);
          const data = await res.json();

          if (data.status === 'succeeded') {
            const isPreviewStage = currentJob.stage === 'preview';
            
            setCurrentJob(prev => prev ? {
              ...prev,
              status: 'succeeded',
              progress: 100,
              modelUrl: data.modelUrl,
              thumbnailUrl: data.thumbnailUrl,
              previewTaskId: isPreviewStage ? currentJob.taskId : prev.previewTaskId,
              stage: isPreviewStage ? 'preview' : 'ready',
            } : null);

            const stageMsg = isPreviewStage 
              ? "Preview ready! Click 'Refine' to generate the full detail model for printing."
              : `Your model is ready! Here's your ${currentJob.prompt}. Drag to rotate, scroll to zoom.`;

            setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: stageMsg,
              timestamp: new Date().toISOString(),
            }]);

            if (pollInterval.current) clearInterval(pollInterval.current);
          } else if (data.status === 'failed') {
            setCurrentJob(prev => prev ? { ...prev, status: 'failed' } : null);
            setError(data.error || 'Generation failed');
            if (pollInterval.current) clearInterval(pollInterval.current);
          } else {
            setCurrentJob(prev => prev ? { ...prev, progress: data.progress || prev.progress } : null);
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 2000);  // Poll every 2 sec for fast preview
    }

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [currentJob?.taskId, currentJob?.status, currentJob?.stage]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setIsLoading(true);
    setError(null);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: content, style: 'cartoon' }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setCurrentJob({
        taskId: data.taskId,
        stage: 'preview',
        status: 'generating',
        progress: 0,
        modelUrl: null,
        thumbnailUrl: null,
        prompt: content,
      });

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Creating a quick preview of "${content}"... (~10 seconds)`,
        timestamp: new Date().toISOString(),
      }]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Sorry, something went wrong. Please try again!",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refineModel = useCallback(async () => {
    if (!currentJob?.previewTaskId) return;

    setError(null);
    
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewTaskId: currentJob.previewTaskId }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setCurrentJob(prev => prev ? {
        ...prev,
        taskId: data.taskId,
        stage: 'refining',
        status: 'generating',
        progress: 0,
      } : null);

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Refining to full detail... (~2 minutes)",
        timestamp: new Date().toISOString(),
      }]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refine');
    }
  }, [currentJob?.previewTaskId]);

  const clearJob = useCallback(() => {
    setCurrentJob(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    currentJob,
    isLoading,
    error,
    sendMessage,
    refineModel,
    clearJob,
    clearError,
  };
}
