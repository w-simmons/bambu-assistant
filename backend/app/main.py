"""
Bambu Assistant Backend

FastAPI application for AI-powered 3D printing assistant.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api import chat, jobs, printer


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print("Bambu Assistant Backend starting...")
    yield
    # Shutdown
    print("Bambu Assistant Backend shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Bambu Assistant API",
    description="AI-powered 3D printing assistant with Meshy + Bambu P1S integration",
    version="0.1.0",
    lifespan=lifespan
)

# Configure CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router)
app.include_router(jobs.router)
app.include_router(printer.router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "bambu-assistant-api",
        "version": "0.1.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    """Detailed health check."""
    from app.services.bridge import get_bridge_client
    
    bridge = get_bridge_client()
    bridge_ok = False
    printer_ok = False
    
    try:
        status = await bridge.get_status()
        bridge_ok = True
        printer_ok = status.connected
    except Exception:
        pass
    
    return {
        "api": "ok",
        "bridge": "ok" if bridge_ok else "unreachable",
        "printer": "connected" if printer_ok else "disconnected"
    }


# For local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
