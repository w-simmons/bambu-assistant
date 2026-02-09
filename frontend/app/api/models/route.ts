import { NextRequest, NextResponse } from 'next/server';
import { requireDb, models } from '@/lib/db';
import { desc } from 'drizzle-orm';

// GET /api/models - List all models
export async function GET(request: NextRequest) {
  try {
    const db = requireDb();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const result = await db
      .select()
      .from(models)
      .orderBy(desc(models.createdAt))
      .limit(limit);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('List models error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list models';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/models - Create a new model
export async function POST(request: NextRequest) {
  try {
    const db = requireDb();
    const body = await request.json();
    const { prompt, style, previewTaskId } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
    }

    const [newModel] = await db
      .insert(models)
      .values({
        prompt,
        style: style || 'cartoon',
        previewTaskId,
        status: previewTaskId ? 'preview_pending' : 'preview_pending',
      })
      .returning();

    return NextResponse.json(newModel);
  } catch (error) {
    console.error('Create model error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create model';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
