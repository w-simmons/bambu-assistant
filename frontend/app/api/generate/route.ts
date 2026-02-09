import { NextRequest, NextResponse } from 'next/server';
import { MOCK_ENABLED, createMockPreviewTask } from '@/lib/mock-data';
import { db, models } from '@/lib/db';

const MESHY_API_KEY = process.env.MESHY_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { prompt, style = 'cartoon' } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
    }

    // Mock mode for development
    if (MOCK_ENABLED) {
      console.log('[MOCK] Generate preview for:', prompt);
      const taskId = createMockPreviewTask();
      
      // Save to DB if available
      let modelId = null;
      if (db) {
        try {
          const [newModel] = await db.insert(models).values({
            prompt,
            style,
            previewTaskId: taskId,
            status: 'preview_pending',
          }).returning();
          modelId = newModel.id;
        } catch (e) {
          console.error('DB save error:', e);
        }
      }
      
      return NextResponse.json({
        taskId,
        modelId,
        status: 'generating',
        message: '[MOCK MODE] Preview generation started (5 seconds)',
      });
    }

    // Real Meshy API
    const enhancedPrompt = `${prompt}, ${style} style, solid base for stability, suitable for 3D printing, high quality details`;

    const response = await fetch('https://api.meshy.ai/openapi/v2/text-to-3d', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'preview',
        prompt: enhancedPrompt,
        ai_model: 'meshy-6',
        topology: 'quad',
        target_polycount: 30000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Meshy error:', error);
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
    }

    const data = await response.json();
    const taskId = data.result;
    
    // Save to DB if available
    let modelId = null;
    if (db) {
      try {
        const [newModel] = await db.insert(models).values({
          prompt,
          style,
          previewTaskId: taskId,
          status: 'preview_pending',
        }).returning();
        modelId = newModel.id;
        console.log('Saved model to DB:', modelId);
      } catch (e) {
        console.error('DB save error:', e);
      }
    }
    
    return NextResponse.json({
      taskId,
      modelId,
      status: 'generating',
      message: 'Model generation started. This takes about 2 minutes.',
    });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
