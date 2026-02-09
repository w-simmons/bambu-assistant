import { pgTable, text, timestamp, integer, boolean, uuid } from 'drizzle-orm/pg-core';

export const models = pgTable('models', {
  id: uuid('id').defaultRandom().primaryKey(),
  prompt: text('prompt').notNull(),
  style: text('style').default('cartoon'),
  
  // Meshy task IDs
  previewTaskId: text('preview_task_id'),
  refineTaskId: text('refine_task_id'),
  
  // Status: preview_pending, preview_ready, refining, ready, failed
  status: text('status').notNull().default('preview_pending'),
  
  // URLs from Meshy
  thumbnailUrl: text('thumbnail_url'),
  modelUrl: text('model_url'),  // GLB file
  
  // Print info
  printStatus: text('print_status'),  // null, printing, completed, failed
  printStartedAt: timestamp('print_started_at'),
  printCompletedAt: timestamp('print_completed_at'),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;
