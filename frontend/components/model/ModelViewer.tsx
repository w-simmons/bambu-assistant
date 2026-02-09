'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface ModelViewerProps {
  modelUrl: string;
  thumbnailUrl?: string;
  className?: string;
  autoRotate?: boolean;
}

export function ModelViewer({ modelUrl, thumbnailUrl, className, autoRotate = true }: ModelViewerProps) {
  const [isClient, setIsClient] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    setLoadError(false);
    
    // Dynamically import model-viewer to avoid SSR issues
    if (typeof window !== 'undefined') {
      import('@google/model-viewer').catch(() => {
        console.error('Failed to load model-viewer');
        setLoadError(true);
      });
    }
  }, [modelUrl]);

  if (!isClient) {
    return (
      <div className={`${className} bg-gray-900 rounded-lg flex items-center justify-center`}>
        <span className="text-gray-400">Loading viewer...</span>
      </div>
    );
  }

  if (loadError || !modelUrl) {
    if (thumbnailUrl) {
      return (
        <div className={`${className} bg-gray-900 rounded-lg overflow-hidden relative`}>
          <Image
            src={thumbnailUrl}
            alt="3D Model Preview"
            fill
            className="object-contain"
            unoptimized
          />
          <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-xs p-2 rounded text-center">
            3D viewer unavailable • Showing preview image
          </div>
        </div>
      );
    }
    return (
      <div className={`${className} bg-gray-900 rounded-lg flex items-center justify-center`}>
        <span className="text-gray-400">No model available</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`${className} bg-gray-900 rounded-lg overflow-hidden`}>
      {/* @ts-expect-error - model-viewer is a web component */}
      <model-viewer
        src={modelUrl}
        poster={thumbnailUrl}
        alt="3D Model"
        auto-rotate={autoRotate ? '' : undefined}
        camera-controls
        touch-action="none"
        interaction-prompt="auto"
        shadow-intensity="1"
        exposure="0.8"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#1a1a1a',
          touchAction: 'none',
        }}
        onError={() => setLoadError(true)}
      />
    </div>
  );
}
