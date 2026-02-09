'use client';

import { PrinterStatus as PrinterStatusType } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PrinterStatusProps {
  status: PrinterStatusType;
  className?: string;
}

export function PrinterStatus({ status, className }: PrinterStatusProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <StatusIndicator state={status.state} />
      <Badge variant={getStateVariant(status.state)}>
        {getStateLabel(status.state)}
      </Badge>
    </div>
  );
}

function StatusIndicator({ state }: { state: PrinterStatusType['state'] }) {
  const colors: Record<PrinterStatusType['state'], string> = {
    idle: 'bg-green-500',
    running: 'bg-blue-500 animate-pulse',
    paused: 'bg-yellow-500',
    finished: 'bg-green-500',
    failed: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  return (
    <span className={cn('w-2 h-2 rounded-full', colors[state])} />
  );
}

function getStateVariant(state: PrinterStatusType['state']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (state) {
    case 'running':
      return 'default';
    case 'paused':
    case 'finished':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getStateLabel(state: PrinterStatusType['state']): string {
  switch (state) {
    case 'idle':
      return 'Ready';
    case 'running':
      return 'Printing';
    case 'paused':
      return 'Paused';
    case 'finished':
      return 'Finished';
    case 'failed':
      return 'Failed';
    case 'offline':
      return 'Offline';
    default:
      return state;
  }
}
