import { NextRequest, NextResponse } from 'next/server';
import { MOCK_ENABLED, createMockRefineTask } from '@/lib/mock-data';
import { db, models } from '@/lib/db';
import { eq } from 'drizzle-orm';

const MESHY_API_KEY = process.env.MESHY_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { previewTaskId, modelId } = await request.json();

    if (!previewTaskId) {
      return NextResponse.json({ error: 'Preview task ID required' }, { status: 400 });
    }

    // Mock mode for development
    if (MOCK_ENABLED || previewTaskId.startsWith('mock-')) {
      console.log('[MOCK] Refine from preview:', previewTaskId);
      const taskId = createMockRefineTask(previewTaskId);
      
      // Update DB if modelId provided
      if (modelId && db) {
        try {
          await db.update(models)
            .set({
              refineTaskId: taskId,
              status: 'refining',
              updatedAt: new Date(),
            })
            .where(eq(models.id, modelId));
        } catch (e) {
          console.error('DB update error:', e);
        }
      }
      
      return NextResponse.json({
        taskId,
        status: 'refining',
        message: '[MOCK MODE] Refining model (10 seconds)',
      });
    }

    // Real Meshy API
    const response = await fetch('https://api.meshy.ai/openapi/v2/text-to-3d', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'refine',
        preview_task_id: previewTaskId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Meshy refine error:', error);
      return NextResponse.json({ error: 'Refine failed' }, { status: 500 });
    }

    const data = await response.json();
    const taskId = data.result;
    
    // Update DB if modelId provided
    if (modelId && db) {
      try {
        await db.update(models)
          .set({
            refineTaskId: taskId,
            status: 'refining',
            updatedAt: new Date(),
          })
          .where(eq(models.id, modelId));
        console.log('Updated model with refine task:', modelId, taskId);
      } catch (e) {
        console.error('DB update error:', e);
      }
    }
    
    return NextResponse.json({
      taskId,
      status: 'refining',
      message: 'Refining model. This takes about 2 minutes.',
    });
  } catch (error) {
    console.error('Refine error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
