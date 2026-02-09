'use client';

import { useJobs } from '@/hooks/useJob';
import { ModelCard } from '@/components/model/ModelCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

export default function HistoryPage() {
  const { jobs, isLoading, error, refresh } = useJobs();

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center space-y-4 py-12">
          <span className="text-4xl">📋</span>
          <h2 className="text-lg font-semibold">Failed to load history</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={refresh}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Print History</h1>
        <Button variant="outline" size="sm" onClick={refresh}>
          ↻ Refresh
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center space-y-4 py-12">
          <span className="text-6xl">🦕</span>
          <h2 className="text-lg font-semibold">No prints yet!</h2>
          <p className="text-muted-foreground">
            Head to the Chat page to create your first 3D model.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {jobs.map((job) => (
            <ModelCard
              key={job.id}
              job={job}
              showActions={job.status === 'ready' || job.status === 'complete'}
              onPrint={
                job.status === 'ready'
                  ? async () => {
                      await api.confirmPrint(job.id);
                      refresh();
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
