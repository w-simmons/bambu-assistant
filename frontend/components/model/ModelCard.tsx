'use client';

import { useState } from 'react';
import { Job, api } from '@/lib/api';
import { ModelViewer } from './ModelViewer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ModelCardProps {
  job: Job;
  className?: string;
  showActions?: boolean;
  onPrint?: () => void;
}

export function ModelCard({ job, className, showActions, onPrint }: ModelCardProps) {
  const [showViewer, setShowViewer] = useState(false);

  const thumbnailUrl = job.thumbnail_url || (job.id ? api.getThumbnailUrl(job.id) : null);
  const modelUrl = job.model_url || (job.id ? api.getModelUrl(job.id) : null);

  return (
    <>
      <Card className={cn('overflow-hidden', className)}>
        <div
          className="aspect-square bg-muted relative cursor-pointer group"
          onClick={() => modelUrl && setShowViewer(true)}
        >
          {thumbnailUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt={job.prompt}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-sm font-medium">View in 3D</span>
              </div>
            </>
          ) : (
            <Skeleton className="w-full h-full" />
          )}
          
          <Badge
            variant={getStatusVariant(job.status)}
            className="absolute top-2 right-2"
          >
            {getStatusLabel(job.status)}
          </Badge>
        </div>
        
        <CardContent className="p-3">
          <p className="font-medium text-sm line-clamp-2">{job.prompt}</p>
          
          {job.dimensions && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatDimensions(job.dimensions)}
            </p>
          )}
          
          {job.estimated_time && job.status === 'ready' && (
            <p className="text-xs text-muted-foreground mt-1">
              Est. print time: {formatTime(job.estimated_time)}
            </p>
          )}

          {showActions && job.status === 'ready' && onPrint && (
            <Button size="sm" className="w-full mt-2" onClick={onPrint}>
              🖨️ Print
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 3D Viewer Dialog */}
      <Dialog open={showViewer} onOpenChange={setShowViewer}>
        <DialogContent className="max-w-4xl w-full h-[80vh]">
          <DialogTitle className="sr-only">3D Model Viewer</DialogTitle>
          <DialogDescription className="sr-only">
            Interactive 3D preview of {job.prompt}
          </DialogDescription>
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
              {modelUrl && (
                <ModelViewer modelUrl={modelUrl} className="w-full h-full" />
              )}
            </div>
            <div className="pt-4 border-t mt-4">
              <p className="font-medium">{job.prompt}</p>
              {job.dimensions && (
                <p className="text-sm text-muted-foreground">
                  Size: {formatDimensions(job.dimensions)}
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getStatusVariant(status: Job['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'complete':
      return 'default';
    case 'printing':
    case 'generating':
      return 'secondary';
    case 'failed':
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getStatusLabel(status: Job['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'generating':
      return 'Generating';
    case 'ready':
      return 'Ready';
    case 'printing':
      return 'Printing';
    case 'complete':
      return 'Complete';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

function formatDimensions(dims: { width: number; depth: number; height: number }): string {
  const w = dims.width.toFixed(0);
  const d = dims.depth.toFixed(0);
  const h = dims.height.toFixed(0);
  return `${w} × ${d} × ${h} mm`;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
