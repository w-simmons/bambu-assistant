"""
Meshy API integration for text-to-3D generation.

Meshy API: https://docs.meshy.ai
- POST /openapi/v2/text-to-3d (create preview or refine task)
- GET /openapi/v2/text-to-3d/{task_id} (poll status)
"""
import asyncio
from dataclasses import dataclass
from enum import Enum
from typing import Optional

import httpx

from app.config import get_settings


class TaskStatus(Enum):
    """Meshy task status."""
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


@dataclass
class MeshyTask:
    """Meshy task result."""
    id: str
    status: TaskStatus
    progress: int
    model_urls: Optional[dict] = None
    thumbnail_url: Optional[str] = None
    error: Optional[str] = None


class MeshyError(Exception):
    """Meshy API error."""
    pass


class MeshyService:
    """
    Meshy API client for text-to-3D generation.
    
    Pipeline:
    1. create_preview_task() - Generate base geometry (~2 min)
    2. poll until SUCCEEDED
    3. create_refine_task() - Add textures (~1 min)
    4. poll until SUCCEEDED
    5. Download GLB from model_urls
    """
    
    BASE_URL = "https://api.meshy.ai"
    
    def __init__(self):
        settings = get_settings()
        self.api_key = settings.meshy_api_key
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def create_preview_task(
        self,
        prompt: str,
        style: str = "cartoon",
        target_polycount: int = 50000
    ) -> str:
        """
        Create a preview task for geometry generation.
        
        Args:
            prompt: Detailed description of the 3D model
            style: "realistic" | "cartoon" | "sculpture"
            target_polycount: Target polygon count (balance detail vs print time)
        
        Returns:
            task_id: UUID for polling status
        """
        payload = {
            "mode": "preview",
            "prompt": self._enhance_prompt(prompt),
            "ai_model": "meshy-6",
            "topology": "quad",
            "target_polycount": target_polycount,
            "should_remesh": True,
            "symmetry_mode": "auto"
        }
        
        # For characters/figures, use A-pose
        if any(word in prompt.lower() for word in ["character", "figure", "person", "animal"]):
            payload["pose_mode"] = "a-pose"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.BASE_URL}/openapi/v2/text-to-3d",
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            return response.json()["result"]
    
    async def create_refine_task(
        self,
        preview_task_id: str,
        texture_prompt: Optional[str] = None
    ) -> str:
        """
        Create a refine task to add textures to preview mesh.
        
        Args:
            preview_task_id: Task ID from completed preview
            texture_prompt: Optional additional texture guidance
        
        Returns:
            task_id: UUID for polling status
        """
        payload = {
            "mode": "refine",
            "preview_task_id": preview_task_id,
            "enable_pbr": True,
        }
        
        if texture_prompt:
            payload["texture_prompt"] = texture_prompt
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.BASE_URL}/openapi/v2/text-to-3d",
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            return response.json()["result"]
    
    async def get_task_status(self, task_id: str) -> MeshyTask:
        """Poll task status."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.BASE_URL}/openapi/v2/text-to-3d/{task_id}",
                headers=self.headers
            )
            response.raise_for_status()
            data = response.json()
            
            return MeshyTask(
                id=data["id"],
                status=TaskStatus(data["status"]),
                progress=data.get("progress", 0),
                model_urls=data.get("model_urls"),
                thumbnail_url=data.get("thumbnail_url"),
                error=data.get("task_error", {}).get("message") if data.get("task_error") else None
            )
    
    async def wait_for_task(
        self,
        task_id: str,
        poll_interval: float = 5.0,
        timeout: float = 300.0
    ) -> MeshyTask:
        """
        Poll task until completion.
        
        Args:
            task_id: Task ID to poll
            poll_interval: Seconds between polls
            timeout: Maximum wait time
        
        Returns:
            Completed MeshyTask
        
        Raises:
            TimeoutError: If task doesn't complete in time
            MeshyError: If task fails
        """
        start = asyncio.get_event_loop().time()
        
        while True:
            if asyncio.get_event_loop().time() - start > timeout:
                raise TimeoutError(f"Task {task_id} timed out after {timeout}s")
            
            task = await self.get_task_status(task_id)
            
            if task.status == TaskStatus.SUCCEEDED:
                return task
            elif task.status == TaskStatus.FAILED:
                raise MeshyError(f"Task failed: {task.error}")
            elif task.status == TaskStatus.EXPIRED:
                raise MeshyError("Task expired")
            
            await asyncio.sleep(poll_interval)
    
    async def generate_model(
        self,
        prompt: str,
        style: str = "cartoon",
        texture_prompt: Optional[str] = None,
        on_progress: Optional[callable] = None
    ) -> dict:
        """
        Complete flow to generate a textured 3D model.
        
        Args:
            prompt: Description of the model
            style: Visual style
            texture_prompt: Optional texture guidance
            on_progress: Callback for progress updates (stage, percent)
        
        Returns:
            dict with preview_task_id, refine_task_id, model_urls, thumbnail_url
        """
        # Stage 1: Preview
        if on_progress:
            on_progress("preview", 0)
        
        preview_task_id = await self.create_preview_task(prompt, style)
        
        # Poll preview with progress updates
        while True:
            task = await self.get_task_status(preview_task_id)
            if on_progress:
                on_progress("preview", task.progress)
            
            if task.status == TaskStatus.SUCCEEDED:
                break
            elif task.status in (TaskStatus.FAILED, TaskStatus.EXPIRED):
                raise MeshyError(f"Preview failed: {task.error}")
            
            await asyncio.sleep(5.0)
        
        # Stage 2: Refine
        if on_progress:
            on_progress("refine", 0)
        
        refine_task_id = await self.create_refine_task(preview_task_id, texture_prompt)
        
        # Poll refine with progress updates
        while True:
            task = await self.get_task_status(refine_task_id)
            if on_progress:
                on_progress("refine", task.progress)
            
            if task.status == TaskStatus.SUCCEEDED:
                return {
                    "preview_task_id": preview_task_id,
                    "refine_task_id": refine_task_id,
                    "model_urls": task.model_urls,
                    "thumbnail_url": task.thumbnail_url
                }
            elif task.status in (TaskStatus.FAILED, TaskStatus.EXPIRED):
                raise MeshyError(f"Refine failed: {task.error}")
            
            await asyncio.sleep(5.0)
    
    def _enhance_prompt(self, prompt: str) -> str:
        """Enhance prompt for printability."""
        enhancements = [
            "solid base for stability",
            "no thin overhanging parts",
            "minimum wall thickness 2mm",
            "suitable for FDM 3D printing"
        ]
        return f"{prompt}, {', '.join(enhancements)}"


# Singleton instance
_meshy_service: Optional[MeshyService] = None


def get_meshy_service() -> MeshyService:
    """Get Meshy service singleton."""
    global _meshy_service
    if _meshy_service is None:
        _meshy_service = MeshyService()
    return _meshy_service
