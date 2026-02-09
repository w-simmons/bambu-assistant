import { NextRequest, NextResponse } from 'next/server';
import { db, models } from '@/lib/db';
import { eq } from 'drizzle-orm';

// GET /api/models/[id] - Get a single model
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const [model] = await db
      .select()
      .from(models)
      .where(eq(models.id, id))
      .limit(1);
    
    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    
    return NextResponse.json(model);
  } catch (error) {
    console.error('Get model error:', error);
    return NextResponse.json({ error: 'Failed to get model' }, { status: 500 });
  }
}

// PATCH /api/models/[id] - Update a model
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const [updated] = await db
      .update(models)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(models.id, id))
      .returning();
    
    if (!updated) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update model error:', error);
    return NextResponse.json({ error: 'Failed to update model' }, { status: 500 });
  }
}

// DELETE /api/models/[id] - Delete a model
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const [deleted] = await db
      .delete(models)
      .where(eq(models.id, id))
      .returning();
    
    if (!deleted) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete model error:', error);
    return NextResponse.json({ error: 'Failed to delete model' }, { status: 500 });
  }
}
