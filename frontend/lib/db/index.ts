import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Make DB connection optional - won't crash if DATABASE_URL isn't set
const DATABASE_URL = process.env.DATABASE_URL;

const sql = DATABASE_URL ? neon(DATABASE_URL) : null;
export const db = sql ? drizzle(sql, { schema }) : null;

export function requireDb() {
  if (!db) {
    throw new Error('Database not configured. Set DATABASE_URL environment variable.');
  }
  return db;
}

export * from './schema';
