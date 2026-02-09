'use client';

import { Suspense, useRef, useState, useEffect, Component, ReactNode } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, Center, Html } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

interface ModelViewerProps {
  modelUrl: string;
  className?: string;
  autoRotate?: boolean;
}

// Error Boundary for Three.js crashes
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
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

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-100 rounded-lg p-4">
      <span className="text-4xl mb-2">⚠️</span>
      <span className="text-sm text-red-600 font-medium">Failed to load 3D model</span>
      <span className="text-xs text-gray-500 mt-1 text-center max-w-xs">{message}</span>
    </div>
  );
}

export function ModelViewer({ modelUrl, className, autoRotate = true }: ModelViewerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Reset error when URL changes
    setError(null);
  }, [modelUrl]);

  // Don't render on server
  if (!isClient) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center`}>
        <span className="text-gray-500">Loading viewer...</span>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay message={error} />;
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
      <ErrorBoundary fallback={<ErrorDisplay message="3D viewer crashed. Try refreshing." />}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          style={{ background: 'transparent' }}
          onError={(e) => {
            console.error('Canvas error:', e);
            setError('Failed to initialize 3D viewer');
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
            autoRotate={false}
          />
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}
