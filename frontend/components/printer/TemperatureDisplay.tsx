'use client';

import { PrinterStatus } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TemperatureDisplayProps {
  status: PrinterStatus;
  className?: string;
}

export function TemperatureDisplay({ status, className }: TemperatureDisplayProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Temperatures</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TemperatureBar
          label="🔥 Nozzle"
          current={status.nozzle_temp}
          target={status.nozzle_target}
          max={300}
        />
        <TemperatureBar
          label="🛏️ Bed"
          current={status.bed_temp}
          target={status.bed_target}
          max={120}
        />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">📦 Chamber</span>
          <span className="font-medium">{status.chamber_temp.toFixed(0)}°C</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface TemperatureBarProps {
  label: string;
  current: number;
  target: number;
  max: number;
}

function TemperatureBar({ label, current, target, max }: TemperatureBarProps) {
  const currentPercent = Math.min((current / max) * 100, 100);
  const targetPercent = Math.min((target / max) * 100, 100);
  const isHeating = target > 0 && current < target - 5;
  const isAtTemp = target > 0 && Math.abs(current - target) <= 5;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {current.toFixed(0)}°C
          {target > 0 && (
            <span className="text-muted-foreground"> / {target.toFixed(0)}°C</span>
          )}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden relative">
        {/* Target indicator */}
        {target > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/30 z-10"
            style={{ left: `${targetPercent}%` }}
          />
        )}
        {/* Current temperature */}
        <div
          className={cn(
            'h-full transition-all duration-500 rounded-full',
            isAtTemp
              ? 'bg-green-500'
              : isHeating
              ? 'bg-orange-500'
              : current > 50
              ? 'bg-red-500'
              : 'bg-blue-500'
          )}
          style={{ width: `${currentPercent}%` }}
        />
      </div>
    </div>
  );
}
