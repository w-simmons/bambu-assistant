'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Script from 'next/script';

interface ModelViewerProps {
  modelUrl: string;
  thumbnailUrl?: string;
  className?: string;
  autoRotate?: boolean;
}

export function ModelViewer({ modelUrl, thumbnailUrl, className, autoRotate = true }: ModelViewerProps) {
  const [isClient, setIsClient] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    setLoadError(false);
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
    <div ref={containerRef} className={`${className} bg-gray-900 rounded-lg overflow-hidden relative`}>
      {/* Load model-viewer from CDN for better mobile support */}
      <Script
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
        type="module"
        onLoad={() => setScriptLoaded(true)}
        onError={() => setLoadError(true)}
      />
      
      {!scriptLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-gray-400 text-sm">Loading 3D viewer...</span>
          </div>
        </div>
      )}
      
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
          minHeight: '300px',
          backgroundColor: '#1a1a1a',
          touchAction: 'none',
        }}
        onError={() => setLoadError(true)}
      />
    </div>
  );
}
