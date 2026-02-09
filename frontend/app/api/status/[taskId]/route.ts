import { NextRequest, NextResponse } from 'next/server';
import { MOCK_ENABLED, getMockTaskStatus } from '@/lib/mock-data';
import { db, models } from '@/lib/db';
import { eq, or } from 'drizzle-orm';

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
      
      // Update DB if succeeded
      if (mockStatus.status === 'succeeded' && db) {
        try {
          const isPreview = taskId.startsWith('mock-preview');
          await db.update(models)
            .set({
              status: isPreview ? 'preview_ready' : 'ready',
              thumbnailUrl: mockStatus.thumbnailUrl,
              modelUrl: mockStatus.modelUrl,
              updatedAt: new Date(),
            })
            .where(or(
              eq(models.previewTaskId, taskId),
              eq(models.refineTaskId, taskId)
            ));
        } catch (e) {
          console.error('DB update error:', e);
        }
      }
      
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
    
    const status = data.status.toLowerCase();
    const modelUrl = data.model_urls?.glb || null;
    const thumbnailUrl = data.thumbnail_url || null;
    
    // Update DB on completion
    if (status === 'succeeded' && db) {
      try {
        // Determine if this is preview or refine task
        const [existingModel] = await db.select().from(models)
          .where(or(
            eq(models.previewTaskId, taskId),
            eq(models.refineTaskId, taskId)
          ))
          .limit(1);
        
        if (existingModel) {
          const isPreview = existingModel.previewTaskId === taskId;
          await db.update(models)
            .set({
              status: isPreview ? 'preview_ready' : 'ready',
              thumbnailUrl: thumbnailUrl || existingModel.thumbnailUrl,
              modelUrl: modelUrl || existingModel.modelUrl,
              updatedAt: new Date(),
            })
            .where(eq(models.id, existingModel.id));
          console.log('Updated model in DB:', existingModel.id);
        }
      } catch (e) {
        console.error('DB update error:', e);
      }
    } else if (status === 'failed' && db) {
      try {
        await db.update(models)
          .set({
            status: 'failed',
            updatedAt: new Date(),
          })
          .where(or(
            eq(models.previewTaskId, taskId),
            eq(models.refineTaskId, taskId)
          ));
      } catch (e) {
        console.error('DB update error:', e);
      }
    }
    
    return NextResponse.json({
      taskId: data.id,
      status,
      progress: data.progress || 0,
      modelUrl,
      thumbnailUrl,
      error: data.task_error?.message || null,
    });
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
