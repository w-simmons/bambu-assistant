"""
Print job management API endpoints.
"""
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.assistant import get_assistant
from app.services.bridge import get_bridge_client, BridgeError

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobSummary(BaseModel):
    """Job summary for list view."""
    id: str
    prompt: str
    status: str
    progress: int
    thumbnail_url: Optional[str] = None
    created_at: str


class JobDimensions(BaseModel):
    """Model dimensions."""
    width_mm: Optional[float] = None
    depth_mm: Optional[float] = None
    height_mm: Optional[float] = None


class JobDetail(BaseModel):
    """Detailed job information."""
    id: str
    prompt: str
    style: str
    status: str
    progress: int
    model_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    dimensions: Optional[JobDimensions] = None
    target_size_mm: float
    warnings: list[str] = []
    estimated_print_minutes: Optional[int] = None
    error: Optional[str] = None
    created_at: str


class PrintRequest(BaseModel):
    """Print start request."""
    bed_leveling: bool = True
    use_ams: bool = False


class PrintResponse(BaseModel):
    """Print start response."""
    success: bool
    message: str
    estimated_minutes: Optional[int] = None


@router.get("", response_model=list[JobSummary])
async def list_jobs() -> list[JobSummary]:
    """List all print jobs."""
    assistant = get_assistant()
    
    jobs = []
    for job_id, job in assistant.jobs.items():
        jobs.append(JobSummary(
            id=job_id,
            prompt=job.get("prompt", ""),
            status=job.get("status", "unknown"),
            progress=job.get("progress", 0),
            thumbnail_url=job.get("thumbnail_url"),
            created_at=job.get("created_at", datetime.utcnow().isoformat())
        ))
    
    # Sort by created_at descending
    jobs.sort(key=lambda j: j.created_at, reverse=True)
    return jobs


@router.get("/{job_id}", response_model=JobDetail)
async def get_job(job_id: str) -> JobDetail:
    """Get detailed job information."""
    assistant = get_assistant()
    
    job = assistant.jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    
    dimensions = None
    if job.get("width_mm"):
        dimensions = JobDimensions(
            width_mm=job.get("width_mm"),
            depth_mm=job.get("depth_mm"),
            height_mm=job.get("height_mm")
        )
    
    return JobDetail(
        id=job_id,
        prompt=job.get("prompt", ""),
        style=job.get("style", "cartoon"),
        status=job.get("status", "unknown"),
        progress=job.get("progress", 0),
        model_url=job.get("model_url"),
        thumbnail_url=job.get("thumbnail_url"),
        dimensions=dimensions,
        target_size_mm=job.get("target_size_mm", 150.0),
        warnings=job.get("warnings", []),
        estimated_print_minutes=job.get("estimated_print_minutes"),
        error=job.get("error"),
        created_at=job.get("created_at", datetime.utcnow().isoformat())
    )


@router.post("/{job_id}/print", response_model=PrintResponse)
async def start_print(job_id: str, request: PrintRequest) -> PrintResponse:
    """Start printing a job."""
    assistant = get_assistant()
    
    job = assistant.jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    
    if job.get("status") != "ready":
        raise HTTPException(400, f"Job not ready: {job.get('status')}")
    
    # Check printer
    bridge = get_bridge_client()
    try:
        if not await bridge.is_ready_to_print():
            raise HTTPException(400, "Printer not ready")
    except BridgeError as e:
        raise HTTPException(503, str(e))
    
    # In production: convert GLB to 3MF, upload to printer, start print
    # For now, update status
    job["status"] = "printing"
    job["print_started_at"] = datetime.utcnow().isoformat()
    
    return PrintResponse(
        success=True,
        message="Print started",
        estimated_minutes=job.get("estimated_print_minutes")
    )


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str) -> dict:
    """Cancel a job (generation or print)."""
    assistant = get_assistant()
    
    job = assistant.jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    
    if job.get("status") == "printing":
        # Cancel on printer
        bridge = get_bridge_client()
        try:
            await bridge.stop_print()
        except BridgeError as e:
            raise HTTPException(503, str(e))
    
    job["status"] = "cancelled"
    job["cancelled_at"] = datetime.utcnow().isoformat()
    
    return {"success": True, "message": "Job cancelled"}


@router.delete("/{job_id}")
async def delete_job(job_id: str) -> dict:
    """Delete a job."""
    assistant = get_assistant()
    
    if job_id not in assistant.jobs:
        raise HTTPException(404, "Job not found")
    
    job = assistant.jobs[job_id]
    if job.get("status") == "printing":
        raise HTTPException(400, "Cannot delete active print job")
    
    del assistant.jobs[job_id]
    return {"success": True, "message": "Job deleted"}
