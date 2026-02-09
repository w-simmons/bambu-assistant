import { NextRequest, NextResponse } from 'next/server';
import { MOCK_ENABLED, getMockTaskStatus } from '@/lib/mock-data';

const MESHY_API_KEY = process.env.MESHY_API_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    // Mock mode for development
    if (MOCK_ENABLED || taskId.startsWith('mock-')) {
      const mockStatus = getMockTaskStatus(taskId);
      console.log('[MOCK] Status for', taskId, ':', mockStatus.status, mockStatus.progress + '%');
      return NextResponse.json({
        taskId,
        ...mockStatus,
      });
    }

    // Real Meshy API
    const response = await fetch(`https://api.meshy.ai/openapi/v2/text-to-3d/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
    }

    const data = await response.json();
    console.log('Meshy response:', JSON.stringify(data, null, 2));
    
    return NextResponse.json({
      taskId: data.id,
      status: data.status.toLowerCase(),
      progress: data.progress || 0,
      modelUrl: data.model_urls?.glb || null,
      thumbnailUrl: data.thumbnail_url || null,
      error: data.task_error?.message || null,
    });
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
