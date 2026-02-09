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
  previewTaskId: string | null;
  refineTaskId: string | null;
  thumbnailUrl: string | null;
  modelUrl: string | null;
  createdAt: string;
}

export default function HistoryPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [refining, setRefining] = useState<string | null>(null);

  useEffect(() => {
    fetchModels();
  }, []);

  // Poll for refining models
  useEffect(() => {
    const refiningModels = models.filter(m => m.status === 'refining');
    if (refiningModels.length === 0) return;

    const interval = setInterval(async () => {
      for (const model of refiningModels) {
        if (model.refineTaskId) {
          try {
            const res = await fetch(`/api/status/${model.refineTaskId}`);
            const data = await res.json();
            
            if (data.status === 'succeeded') {
              // Refresh models list
              fetchModels();
            }
          } catch (e) {
            console.error('Poll error:', e);
          }
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [models]);

  async function fetchModels() {
    try {
      const res = await fetch('/api/models?limit=50');
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setModels(data);
        // Update selected model if it exists
        if (selectedModel) {
          const updated = data.find((m: Model) => m.id === selectedModel.id);
          if (updated) setSelectedModel(updated);
        }
      }
    } catch (e) {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine(model: Model) {
    if (!model.previewTaskId) return;
    
    setRefining(model.id);
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          previewTaskId: model.previewTaskId,
          modelId: model.id 
        }),
      });
      
      const data = await res.json();
      if (data.error) {
        alert('Refine failed: ' + data.error);
      } else {
        // Refresh to get updated status
        await fetchModels();
      }
    } catch (e) {
      alert('Failed to start refine');
    } finally {
      setRefining(null);
    }
  }

  function getStatusBadge(status: string) {
    const badges: Record<string, { label: string; color: string }> = {
      preview_pending: { label: '⏳ Generating...', color: 'bg-yellow-500' },
      preview_ready: { label: '✨ Preview Ready', color: 'bg-blue-500' },
      refining: { label: '🔄 Refining...', color: 'bg-purple-500' },
      ready: { label: '✅ Print Ready', color: 'bg-green-500' },
      failed: { label: '❌ Failed', color: 'bg-red-500' },
    };
    return badges[status] || { label: status, color: 'bg-gray-500' };
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

  const badge = selectedModel ? getStatusBadge(selectedModel.status) : null;

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
            {models.map((model) => {
              const statusBadge = getStatusBadge(model.status);
              return (
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
                    <div className="absolute top-2 right-2">
                      <span className={`text-xs px-2 py-1 rounded-full text-white ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-white text-xs truncate">{model.prompt}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Model Preview Modal */}
          {selectedModel && badge && (
            <div 
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedModel(null)}
            >
              <Card 
                className="max-w-2xl w-full max-h-[90vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="aspect-square relative bg-gray-900">
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
                    <div className="flex items-center justify-center h-full text-6xl">
                      🎨
                    </div>
                  )}
                </div>
                <div className="p-4 border-t space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{selectedModel.prompt}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full text-white whitespace-nowrap ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(selectedModel.createdAt).toLocaleString()}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => setSelectedModel(null)}>
                      Close
                    </Button>
                    
                    {/* Refine button for preview_ready models */}
                    {selectedModel.status === 'preview_ready' && (
                      <Button 
                        size="sm" 
                        onClick={() => handleRefine(selectedModel)}
                        disabled={refining === selectedModel.id}
                      >
                        {refining === selectedModel.id ? '⏳ Starting...' : '✨ Refine for Print'}
                      </Button>
                    )}
                    
                    {/* Download button for ready models */}
                    {selectedModel.status === 'ready' && selectedModel.modelUrl && (
                      <Button 
                        size="sm" 
                        variant="default"
                        asChild
                      >
                        <a href={selectedModel.modelUrl} download>
                          ⬇️ Download GLB
                        </a>
                      </Button>
                    )}
                    
                    {/* Refining indicator */}
                    {selectedModel.status === 'refining' && (
                      <Button size="sm" variant="secondary" disabled>
                        🔄 Refining... (~2-3 min)
                      </Button>
                    )}
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
