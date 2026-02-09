'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, PrinterStatus } from '@/lib/api';

export interface UsePrinterReturn {
  status: PrinterStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  pausePrint: () => Promise<void>;
  resumePrint: () => Promise<void>;
  stopPrint: () => Promise<void>;
  toggleLight: () => Promise<void>;
}

const POLL_INTERVAL = 5000; // 5 seconds

export function usePrinter(autoRefresh = true): UsePrinterReturn {
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const newStatus = await api.getPrinterStatus();
      setStatus(newStatus);
      setError(null);
    } catch (err) {
      // Don't overwrite status on transient errors
      if (!status) {
        setError(err instanceof Error ? err.message : 'Failed to fetch printer status');
      }
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  const pausePrint = useCallback(async () => {
    try {
      await api.pausePrint();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause print');
    }
  }, [refresh]);

  const resumePrint = useCallback(async () => {
    try {
      await api.resumePrint();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume print');
    }
  }, [refresh]);

  const stopPrint = useCallback(async () => {
    try {
      await api.stopPrint();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop print');
    }
  }, [refresh]);

  const toggleLight = useCallback(async () => {
    if (!status) return;
    try {
      await api.toggleLight(!status.light_on);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle light');
    }
  }, [status, refresh]);

  // Initial fetch and polling
  useEffect(() => {
    refresh();

    if (!autoRefresh) return;

    const interval = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh, autoRefresh]);

  return {
    status,
    isLoading,
    error,
    refresh,
    pausePrint,
    resumePrint,
    stopPrint,
    toggleLight,
  };
}
