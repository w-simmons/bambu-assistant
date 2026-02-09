"""
Printer status and control API endpoints.

Proxies requests to the local bridge service.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.bridge import get_bridge_client, BridgeError

router = APIRouter(prefix="/printer", tags=["printer"])


class TemperatureInfo(BaseModel):
    """Temperature readings."""
    nozzle: float
    bed: float
    chamber: float


class PrinterStatusResponse(BaseModel):
    """Printer status response."""
    state: str  # idle, running, paused, error, offline
    is_online: bool
    current_job: Optional[str] = None
    progress_percent: Optional[int] = None
    remaining_minutes: Optional[int] = None
    temperatures: Optional[TemperatureInfo] = None


class CommandResponse(BaseModel):
    """Generic command response."""
    success: bool
    message: str


@router.get("/status", response_model=PrinterStatusResponse)
async def get_status() -> PrinterStatusResponse:
    """Get current printer status."""
    bridge = get_bridge_client()
    
    try:
        status = await bridge.get_status()
        
        return PrinterStatusResponse(
            state=status.state,
            is_online=status.connected,
            current_job=status.job_name,
            progress_percent=status.progress if status.state == "running" else None,
            remaining_minutes=status.remaining_minutes if status.state == "running" else None,
            temperatures=TemperatureInfo(
                nozzle=status.nozzle_temp,
                bed=status.bed_temp,
                chamber=status.chamber_temp
            ) if status.connected else None
        )
    except BridgeError:
        return PrinterStatusResponse(
            state="offline",
            is_online=False
        )


@router.post("/pause", response_model=CommandResponse)
async def pause_print() -> CommandResponse:
    """Pause the current print."""
    bridge = get_bridge_client()
    
    try:
        await bridge.pause_print()
        return CommandResponse(success=True, message="Print paused")
    except BridgeError as e:
        raise HTTPException(503, str(e))


@router.post("/resume", response_model=CommandResponse)
async def resume_print() -> CommandResponse:
    """Resume a paused print."""
    bridge = get_bridge_client()
    
    try:
        await bridge.resume_print()
        return CommandResponse(success=True, message="Print resumed")
    except BridgeError as e:
        raise HTTPException(503, str(e))


@router.post("/cancel", response_model=CommandResponse)
async def cancel_print() -> CommandResponse:
    """Cancel the current print."""
    bridge = get_bridge_client()
    
    try:
        await bridge.stop_print()
        return CommandResponse(success=True, message="Print cancelled")
    except BridgeError as e:
        raise HTTPException(503, str(e))


@router.post("/light", response_model=CommandResponse)
async def toggle_light(on: bool = True) -> CommandResponse:
    """Toggle chamber light."""
    bridge = get_bridge_client()
    
    try:
        await bridge.set_light(on)
        return CommandResponse(
            success=True,
            message=f"Light {'on' if on else 'off'}"
        )
    except BridgeError as e:
        raise HTTPException(503, str(e))


@router.get("/health")
async def health_check() -> dict:
    """Check if printer bridge is reachable."""
    bridge = get_bridge_client()
    
    try:
        is_online = await bridge.is_online()
        return {
            "bridge_reachable": True,
            "printer_connected": is_online
        }
    except Exception:
        return {
            "bridge_reachable": False,
            "printer_connected": False
        }
