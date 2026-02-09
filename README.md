# Bambu Assistant

AI-powered 3D model generator for Bambu Lab 3D printers.

## Live URL
https://frontend-sandy-chi-62.vercel.app

## Features

- **Chat Interface**: Describe what you want to create ("a unicorn dinosaur")
- **AI Model Generation**: Uses Meshy API to generate 3D models
- **Two-Stage Pipeline**: Quick preview (~1 min) → Refine for print (~2-3 min)
- **3D Viewer**: Interactive model viewer (rotate, zoom)
- **History**: View all generated models, refine from history
- **Database**: Neon Postgres stores all models

## Stack

- **Frontend**: Next.js 15, React, Tailwind CSS, shadcn/ui
- **3D Viewer**: Google model-viewer (CDN)
- **Database**: Neon Postgres (Vercel integration)
- **ORM**: Drizzle
- **API**: Meshy AI for text-to-3D

## Status (2026-02-08)

### Working ✅
- Generate preview from text prompt
- Refine preview to print-ready GLB
- Save models to database
- History page with all models
- Status badges (preview_ready, refining, ready)
- Download GLB button
- Refine from History page

### In Progress 🔄
- 3D viewer on mobile Safari (CDN-loaded, may need more work)
- Printer page (not implemented)

### Not Started ❌
- Bambu Lab printer integration
- Send to printer functionality
- Print status tracking

## Environment Variables

```
DATABASE_URL=postgresql://...
MESHY_API_KEY=msy_...
```

## Database Schema

```sql
CREATE TABLE models (
  id UUID PRIMARY KEY,
  prompt TEXT,
  style TEXT,
  preview_task_id TEXT,
  refine_task_id TEXT,
  status TEXT,
  thumbnail_url TEXT,
  model_url TEXT,
  print_status TEXT,
  print_started_at TIMESTAMP,
  print_completed_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Commands

```bash
cd frontend
pnpm dev          # Local dev
pnpm db:push      # Push schema to DB
vercel --prod     # Deploy
```
