'use client';

import { Suspense, useRef, useState, useEffect, Component, ReactNode } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, Center, Html } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import Image from 'next/image';

interface ModelViewerProps {
  modelUrl: string;
  thumbnailUrl?: string;
  className?: string;
  autoRotate?: boolean;
}

// Error Boundary for Three.js crashes
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

function Model({ url, autoRotate }: { url: string; autoRotate?: boolean }) {
  const gltf = useLoader(GLTFLoader, url);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <Center>
      <group ref={groupRef}>
        <primitive object={gltf.scene} />
      </group>
    </Center>
  );
}

function LoadingSpinner() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-600">Loading 3D model...</span>
      </div>
    </Html>
  );
}

export function ModelViewer({ modelUrl, thumbnailUrl, className, autoRotate = true }: ModelViewerProps) {
  const [viewerFailed, setViewerFailed] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setViewerFailed(false);
  }, [modelUrl]);

  // Show thumbnail fallback if viewer fails or on server
  if (!isClient || viewerFailed) {
    if (thumbnailUrl) {
      return (
        <div className={`${className} bg-gradient-to-b from-gray-50 to-gray-100 rounded-lg overflow-hidden relative`}>
          <Image
            src={thumbnailUrl}
            alt="3D Model Preview"
            fill
            className="object-contain"
            unoptimized
          />
          {viewerFailed && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/50 text-white text-xs p-2 rounded text-center">
              3D viewer unavailable • Showing preview image
            </div>
          )}
        </div>
      );
    }
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center`}>
        <span className="text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!modelUrl) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center`}>
        <span className="text-gray-500">No model to display</span>
      </div>
    );
  }

  return (
    <div className={`${className} bg-gradient-to-b from-gray-50 to-gray-100 rounded-lg overflow-hidden`}>
      <ErrorBoundary onError={() => setViewerFailed(true)}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          style={{ background: 'transparent' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.4} />
          
          <Suspense fallback={<LoadingSpinner />}>
            <Model url={modelUrl} autoRotate={autoRotate} />
            <Environment preset="studio" />
          </Suspense>
          
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={2}
            maxDistance={10}
          />
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}
