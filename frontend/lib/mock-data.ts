// Mock data for development - avoids burning Meshy credits

export const MOCK_ENABLED = process.env.MOCK_MESHY === 'true';

// Sample GLB models from the web (free/open)
const SAMPLE_MODELS = [
  {
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb',
    thumbnailUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/screenshot/screenshot.png',
  },
  {
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BoxAnimated/glTF-Binary/BoxAnimated.glb',
    thumbnailUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BoxAnimated/screenshot/screenshot.png',
  },
  {
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/CesiumMan/glTF-Binary/CesiumMan.glb',
    thumbnailUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/CesiumMan/screenshot/screenshot.png',
  },
];

let mockTaskCounter = 0;
const mockTasks: Map<string, { status: string; progress: number; startedAt: number; modelIndex: number }> = new Map();

export function createMockPreviewTask(): string {
  const taskId = `mock-preview-${++mockTaskCounter}`;
  mockTasks.set(taskId, {
    status: 'PENDING',
    progress: 0,
    startedAt: Date.now(),
    modelIndex: mockTaskCounter % SAMPLE_MODELS.length,
  });
  return taskId;
}

export function createMockRefineTask(previewTaskId: string): string {
  const taskId = `mock-refine-${++mockTaskCounter}`;
  const previewTask = mockTasks.get(previewTaskId);
  mockTasks.set(taskId, {
    status: 'PENDING',
    progress: 0,
    startedAt: Date.now(),
    modelIndex: previewTask?.modelIndex || 0,
  });
  return taskId;
}

export function getMockTaskStatus(taskId: string) {
  const task = mockTasks.get(taskId);
  if (!task) {
    return { status: 'failed', error: 'Task not found' };
  }

  const elapsed = Date.now() - task.startedAt;
  const isPreview = taskId.startsWith('mock-preview');
  const duration = isPreview ? 5000 : 10000; // 5s for preview, 10s for refine

  if (elapsed >= duration) {
    const sample = SAMPLE_MODELS[task.modelIndex];
    return {
      status: 'succeeded',
      progress: 100,
      modelUrl: sample.modelUrl,
      thumbnailUrl: sample.thumbnailUrl,
    };
  }

  const progress = Math.min(95, Math.floor((elapsed / duration) * 100));
  return {
    status: 'pending',
    progress,
    modelUrl: null,
    thumbnailUrl: null,
  };
}
