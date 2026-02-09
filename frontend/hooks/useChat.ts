'use client';

import { useState, useCallback } from 'react';
import { api, Message, Job, ChatResponse } from '@/lib/api';

export interface UseChatReturn {
  messages: Message[];
  currentJob: Job | null;
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  confirmPrint: () => Promise<void>;
  cancelJob: () => Promise<void>;
  clearError: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true);
    setError(null);

    // Add user message immediately
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response: ChatResponse = await api.sendMessage(content, conversationId);
      
      // Update conversation ID from first response
      if (!conversationId && response.message.id) {
        setConversationId(response.message.id.split('-')[0]);
      }

      // Add assistant message
      setMessages(prev => [...prev, response.message]);

      // Update current job if present
      if (response.job) {
        setCurrentJob(response.job);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const confirmPrint = useCallback(async () => {
    if (!currentJob) return;

    setIsLoading(true);
    setError(null);

    try {
      const updatedJob = await api.confirmPrint(currentJob.id);
      setCurrentJob(updatedJob);
      
      // Add confirmation message
      const confirmMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `✅ Print job started! Your ${currentJob.prompt} is now printing. You can monitor the progress on the Printer page.`,
        timestamp: new Date().toISOString(),
        job_id: currentJob.id,
      };
      setMessages(prev => [...prev, confirmMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm print');
    } finally {
      setIsLoading(false);
    }
  }, [currentJob]);

  const cancelJob = useCallback(async () => {
    if (!currentJob) return;

    setIsLoading(true);
    setError(null);

    try {
      await api.cancelJob(currentJob.id);
      setCurrentJob(null);
      
      const cancelMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '❌ Job cancelled. Let me know if you want to try something different!',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, cancelMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
    } finally {
      setIsLoading(false);
    }
  }, [currentJob]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    currentJob,
    isLoading,
    error,
    sendMessage,
    confirmPrint,
    cancelJob,
    clearError,
  };
}
