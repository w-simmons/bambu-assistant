import { NextRequest, NextResponse } from 'next/server';

const MESHY_API_KEY = process.env.MESHY_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { prompt, style = 'cartoon' } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
    }

    // Enhance prompt for printability
    const enhancedPrompt = `${prompt}, ${style} style, solid base for stability, suitable for 3D printing, high quality details`;

    // Create preview task
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
    
    return NextResponse.json({
      taskId: data.result,
      status: 'generating',
      message: 'Model generation started. This takes about 2 minutes.',
    });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
