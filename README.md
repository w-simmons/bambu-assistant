# Bambu Assistant

AI-powered 3D printing assistant that designs and prints toys/objects via natural language.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel (Cloud)                           │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │   Frontend      │     │   Backend (FastAPI)         │   │
│  │   Next.js 15    │────▶│   - Chat/AI Agent           │   │
│  │   Three.js      │     │   - Meshy Integration       │   │
│  └─────────────────┘     │   - Job Management          │   │
│                          └──────────────┬──────────────┘   │
└─────────────────────────────────────────┼──────────────────┘
                                          │ HTTPS (Tailscale)
                                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Mac Mini (Local)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │   Bridge Service                                     │   │
│  │   - REST API for printer control                     │   │
│  │   - MQTT connection to P1S                           │   │
│  │   - FTPS file upload                                 │   │
│  └──────────────────────────┬──────────────────────────┘   │
└─────────────────────────────┼──────────────────────────────┘
                              │ MQTT/FTPS (LAN)
                              ▼
                    ┌─────────────────┐
                    │   Bambu P1S     │
                    └─────────────────┘
```

## Components

### Frontend (`/frontend`)
Next.js 15 app with chat interface and 3D model viewer.

### Backend (`/backend`)
FastAPI service with OpenAI agent and Meshy integration.

### Bridge (`/bridge`)
Local service that connects to Bambu P1S and exposes REST API.

## Quick Start

```bash
# 1. Start the bridge (on Mac mini)
cd bridge
pip install -r requirements.txt
python main.py

# 2. Start backend (local dev)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# 3. Start frontend (local dev)
cd frontend
pnpm install
pnpm dev
```

## Environment Variables

See `.env.example` in each directory.
