"""
Bridge client for communicating with the local printer bridge service.

The bridge runs on the local network (Mac mini) and connects to the Bambu P1S.
Backend communicates with bridge over Tailscale.
"""
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx

from app.config import get_settings


@dataclass
class PrinterStatus:
    """Printer status from bridge."""
    connected: bool
    state: str  # idle, running, paused, etc
    progress: int
    remaining_minutes: int
    job_name: Optional[str]
    nozzle_temp: float
    bed_temp: float
    chamber_temp: float
    last_update: Optional[str]


class BridgeError(Exception):
    """Bridge communication error."""
    pass


class BridgeClient:
    """
    Client for the local bridge service.
    
    Bridge endpoints:
    - GET /status - Printer status
    - POST /upload - Upload 3MF file
    - POST /print - Start print
    - POST /pause - Pause print
    - POST /resume - Resume print
    - POST /stop - Cancel print
    - POST /light - Toggle chamber light
    """
    
    def __init__(self):
        settings = get_settings()
        self.base_url = settings.bridge_url.rstrip("/")
        self.timeout = 30.0
    
    async def _request(self, method: str, path: str, **kwargs) -> dict:
        """Make request to bridge."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.request(
                    method,
                    f"{self.base_url}{path}",
                    **kwargs
                )
                response.raise_for_status()
                return response.json()
            except httpx.ConnectError:
                raise BridgeError("Cannot connect to bridge - is it running?")
            except httpx.HTTPStatusError as e:
                raise BridgeError(f"Bridge error: {e.response.text}")
    
    async def get_status(self) -> PrinterStatus:
        """Get current printer status."""
        data = await self._request("GET", "/status")
        return PrinterStatus(
            connected=data.get("connected", False),
            state=data.get("state", "unknown"),
            progress=data.get("progress", 0),
            remaining_minutes=data.get("remaining_minutes", 0),
            job_name=data.get("job_name"),
            nozzle_temp=data.get("nozzle_temp", 0),
            bed_temp=data.get("bed_temp", 0),
            chamber_temp=data.get("chamber_temp", 0),
            last_update=data.get("last_update")
        )
    
    async def upload_file(self, file_path: Path, filename: Optional[str] = None) -> str:
        """
        Upload a 3MF file to the printer.
        
        Args:
            file_path: Local path to 3MF file
            filename: Optional remote filename
        
        Returns:
            Remote filename on printer
        """
        filename = filename or file_path.name
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            with open(file_path, "rb") as f:
                files = {"file": (filename, f, "application/octet-stream")}
                response = await client.post(
                    f"{self.base_url}/upload",
                    files=files
                )
                response.raise_for_status()
                return response.json().get("filename", filename)
    
    async def start_print(
        self,
        filename: str,
        bed_leveling: bool = True,
        use_ams: bool = False
    ) -> dict:
        """
        Start printing an uploaded file.
        
        Args:
            filename: Name of uploaded 3MF file
            bed_leveling: Run bed leveling before print
            use_ams: Use AMS filament system
        """
        return await self._request(
            "POST",
            "/print",
            json={
                "filename": filename,
                "bed_leveling": bed_leveling,
                "use_ams": use_ams
            }
        )
    
    async def pause_print(self) -> dict:
        """Pause current print."""
        return await self._request("POST", "/pause")
    
    async def resume_print(self) -> dict:
        """Resume paused print."""
        return await self._request("POST", "/resume")
    
    async def stop_print(self) -> dict:
        """Cancel/stop current print."""
        return await self._request("POST", "/stop")
    
    async def set_light(self, on: bool = True) -> dict:
        """Toggle chamber light."""
        return await self._request("POST", "/light", params={"on": on})
    
    async def is_online(self) -> bool:
        """Check if printer is online and connected."""
        try:
            status = await self.get_status()
            return status.connected
        except BridgeError:
            return False
    
    async def is_ready_to_print(self) -> bool:
        """Check if printer is idle and ready."""
        try:
            status = await self.get_status()
            return status.connected and status.state in ("idle", "finish", "failed")
        except BridgeError:
            return False


# Singleton instance
_bridge_client: Optional[BridgeClient] = None


def get_bridge_client() -> BridgeClient:
    """Get bridge client singleton."""
    global _bridge_client
    if _bridge_client is None:
        _bridge_client = BridgeClient()
    return _bridge_client
