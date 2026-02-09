'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, Job } from '@/lib/api';

export interface UseJobReturn {
  job: Job | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL = 3000; // 3 seconds for active jobs

export function useJob(jobId: string | null): UseJobReturn {
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) return;

    try {
      const updatedJob = await api.getJob(jobId);
      setJob(updatedJob);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch job');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  // Initial fetch and polling for active jobs
  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    setIsLoading(true);
    refresh();

    // Poll only for active jobs
    const shouldPoll = job && ['pending', 'generating', 'printing'].includes(job.status);
    if (!shouldPoll) return;

    const interval = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [jobId, job?.status, refresh]);

  return {
    job,
    isLoading,
    error,
    refresh,
  };
}

export interface UseJobsReturn {
  jobs: Job[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useJobs(limit = 20): UseJobsReturn {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const fetchedJobs = await api.listJobs(limit);
      setJobs(fetchedJobs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    jobs,
    isLoading,
    error,
    refresh,
  };
}
