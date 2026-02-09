'use client';

import { PrinterStatus } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PrintProgressProps {
  status: PrinterStatus;
  className?: string;
}

export function PrintProgress({ status, className }: PrintProgressProps) {
  const isActive = status.state === 'running' || status.state === 'paused';

  if (!isActive && status.state !== 'finished') {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{status.job_name || 'Current Print'}</span>
          <span className="text-2xl">
            {status.state === 'finished' ? '✅' : status.state === 'paused' ? '⏸️' : '🖨️'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span className="font-medium">{status.progress_percent}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500 rounded-full',
                status.state === 'finished'
                  ? 'bg-green-500'
                  : status.state === 'paused'
                  ? 'bg-yellow-500'
                  : 'bg-primary'
              )}
              style={{ width: `${status.progress_percent}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Layer</p>
            <p className="font-medium">
              {status.current_layer} / {status.total_layers}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Time Remaining</p>
            <p className="font-medium">
              {formatTime(status.remaining_time_seconds)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '—';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}
