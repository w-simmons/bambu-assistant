'use client';

import { usePrinter } from '@/hooks/usePrinter';
import { PrinterStatus } from '@/components/printer/PrinterStatus';
import { PrintProgress } from '@/components/printer/PrintProgress';
import { TemperatureDisplay } from '@/components/printer/TemperatureDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function PrinterPage() {
  const {
    status,
    isLoading,
    error,
    refresh,
    pausePrint,
    resumePrint,
    stopPrint,
    toggleLight,
  } = usePrinter();

  if (isLoading && !status) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="container mx-auto p-4">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <span className="text-4xl">📡</span>
              <h2 className="text-lg font-semibold">Unable to connect to printer</h2>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={refresh}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!status) return null;

  const isActive = status.state === 'running' || status.state === 'paused';

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Printer Status</h1>
          <PrinterStatus status={status} />
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          ↻ Refresh
        </Button>
      </div>

      {/* Print Progress (if active) */}
      <PrintProgress status={status} />

      {/* Controls and Temperature */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isActive && (
              <div className="grid grid-cols-2 gap-2">
                {status.state === 'running' ? (
                  <Button variant="outline" onClick={pausePrint} className="w-full">
                    ⏸️ Pause
                  </Button>
                ) : (
                  <Button variant="outline" onClick={resumePrint} className="w-full">
                    ▶️ Resume
                  </Button>
                )}
                <Button variant="destructive" onClick={stopPrint} className="w-full">
                  ⏹️ Stop
                </Button>
              </div>
            )}
            
            <Button
              variant="outline"
              onClick={toggleLight}
              className="w-full"
            >
              {status.light_on ? '💡 Light Off' : '🔦 Light On'}
            </Button>

            {!isActive && status.state === 'idle' && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Printer is ready. Start a print from the Chat page!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Temperature */}
        <TemperatureDisplay status={status} />
      </div>

      {/* Quick Stats */}
      {isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Print Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{status.progress_percent}%</p>
                <p className="text-xs text-muted-foreground">Progress</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{status.current_layer}</p>
                <p className="text-xs text-muted-foreground">Current Layer</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{status.total_layers}</p>
                <p className="text-xs text-muted-foreground">Total Layers</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatTimeShort(status.remaining_time_seconds)}
                </p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatTimeShort(seconds: number): string {
  if (seconds <= 0) return '—';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
