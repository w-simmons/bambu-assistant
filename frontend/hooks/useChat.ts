'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ModelJob {
  taskId: string;
  status: 'generating' | 'succeeded' | 'failed';
  progress: number;
  modelUrl: string | null;
  thumbnailUrl: string | null;
  prompt: string;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your 3D printing assistant. Tell me what you'd like to create - like \"a cute cartoon dinosaur\" or \"a rocket ship toy\" - and I'll generate a 3D model for you!",
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
            setCurrentJob(prev => prev ? {
              ...prev,
              status: 'succeeded',
              progress: 100,
              modelUrl: data.modelUrl,
              thumbnailUrl: data.thumbnailUrl,
            } : null);

            setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `Your model is ready! Here's your ${currentJob.prompt}. You can rotate it to see all angles.`,
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
      }, 3000);
    }

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [currentJob?.taskId, currentJob?.status]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setIsLoading(true);
    setError(null);

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Call generate API
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: content, style: 'cartoon' }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Set up job tracking
      setCurrentJob({
        taskId: data.taskId,
        status: 'generating',
        progress: 0,
        modelUrl: null,
        thumbnailUrl: null,
        prompt: content,
      });

      // Add assistant response
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Great choice! I'm creating "${content}" for you now. This usually takes about 2 minutes...`,
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
    clearJob,
    clearError,
    confirmPrint: async () => {},  // Stub for now
    cancelJob: clearJob,
  };
}
