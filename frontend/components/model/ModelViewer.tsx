'use client';

import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF, Center, Html } from '@react-three/drei';
import * as THREE from 'three';

interface ModelViewerProps {
  modelUrl: string;
  className?: string;
  autoRotate?: boolean;
}

function Model({ url, autoRotate }: { url: string; autoRotate?: boolean }) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <Center>
      <group ref={groupRef}>
        <primitive object={scene} />
      </group>
    </Center>
  );
}

function LoadingSpinner() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading model...</span>
      </div>
    </Html>
  );
}

function ErrorFallback({ error }: { error: Error }) {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 text-destructive">
        <span className="text-2xl">⚠️</span>
        <span className="text-sm">Failed to load model</span>
        <span className="text-xs text-muted-foreground">{error.message}</span>
      </div>
    </Html>
  );
}

export function ModelViewer({ modelUrl, className, autoRotate = true }: ModelViewerProps) {
  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} />
        
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
    </div>
  );
}

// Preload models for better UX
export function preloadModel(url: string) {
  useGLTF.preload(url);
}
