'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ModelViewer } from '@/components/model/ModelViewer';

interface Model {
  id: string;
  prompt: string;
  status: string;
  thumbnailUrl: string | null;
  modelUrl: string | null;
  createdAt: string;
}

export default function HistoryPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  useEffect(() => {
    fetchModels();
  }, []);

  async function fetchModels() {
    try {
      const res = await fetch('/api/models?limit=50');
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setModels(data);
      }
    } catch (e) {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-bold">Print History</h1>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-bold">Print History</h1>
        <Card className="p-6 text-center">
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchModels}>Retry</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Print History</h1>
        <Button variant="outline" size="sm" onClick={fetchModels}>
          ↻ Refresh
        </Button>
      </div>

      {models.length === 0 ? (
        <div className="text-center space-y-4 py-12">
          <span className="text-6xl">🦕</span>
          <h2 className="text-lg font-semibold">No prints yet!</h2>
          <p className="text-muted-foreground">
            Head to the Chat page to create your first 3D model.
          </p>
          <Link href="/">
            <Button className="mt-4">
              ← Go to Chat
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {models.map((model) => (
              <Card 
                key={model.id} 
                className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                onClick={() => setSelectedModel(model)}
              >
                <div className="aspect-square relative bg-muted">
                  {model.thumbnailUrl ? (
                    <Image
                      src={model.thumbnailUrl}
                      alt={model.prompt}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-4xl">
                      {model.status === 'failed' ? '❌' : '🎨'}
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-white text-xs truncate">{model.prompt}</p>
                    <p className="text-white/70 text-xs">{model.status}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Model Preview Modal */}
          {selectedModel && (
            <div 
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedModel(null)}
            >
              <Card 
                className="max-w-2xl w-full max-h-[90vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="aspect-square relative">
                  {selectedModel.modelUrl ? (
                    <ModelViewer 
                      modelUrl={selectedModel.modelUrl} 
                      thumbnailUrl={selectedModel.thumbnailUrl || undefined}
                      className="w-full h-full"
                    />
                  ) : selectedModel.thumbnailUrl ? (
                    <Image
                      src={selectedModel.thumbnailUrl}
                      alt={selectedModel.prompt}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-6xl bg-muted">
                      🎨
                    </div>
                  )}
                </div>
                <div className="p-4 border-t">
                  <h3 className="font-semibold mb-1">{selectedModel.prompt}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Status: {selectedModel.status} • Created: {new Date(selectedModel.createdAt).toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedModel(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
