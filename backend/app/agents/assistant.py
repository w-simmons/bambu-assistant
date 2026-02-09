"""
OpenAI-powered 3D printing assistant agent.

Uses the OpenAI Agents SDK for conversation and tool calling.
"""
import asyncio
import uuid
from datetime import datetime
from typing import Optional, Callable, Any

from openai import AsyncOpenAI

from app.config import get_settings
from app.services.meshy import get_meshy_service, MeshyError
from app.services.bridge import get_bridge_client, BridgeError
from app.services.converter import ModelConverter, inches_to_mm


# Agent instructions
ASSISTANT_INSTRUCTIONS = """You are a helpful 3D printing assistant that helps users create and print 3D objects.

Your capabilities:
1. Generate 3D models from text descriptions using AI
2. Show 3D previews to users
3. Send models to a Bambu P1S 3D printer
4. Monitor print progress

Guidelines:
- Ask clarifying questions about style, size, and details before generating
- Always confirm with the user before starting a print
- Provide realistic time estimates
- Warn about potential printing issues (overhangs, thin walls, etc.)
- Be encouraging and helpful, especially for first-time users

Size defaults:
- Small toys: 3-4 inches (75-100mm)
- Medium toys: 5-7 inches (125-175mm)
- Large display pieces: 8-12 inches (200-300mm)

When generating models:
- Add details for printability (solid base, no thin overhangs)
- Suggest cartoon style for toys (prints better than realistic)
- Consider the user's skill level with 3D printing

Available tools:
- generate_3d_model: Create a 3D model from text description
- check_model_status: Check if a model is ready
- get_printer_status: Check printer availability
- start_print: Begin printing a ready model (confirm first!)
- cancel_print: Stop a print in progress
"""


# Tool definitions for OpenAI function calling
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_3d_model",
            "description": "Generate a 3D model from a text description. Use when user wants to create a new object.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "Detailed description of the 3D model to generate"
                    },
                    "style": {
                        "type": "string",
                        "enum": ["cartoon", "realistic", "sculpture"],
                        "description": "Visual style of the model (cartoon recommended for toys)"
                    },
                    "size_inches": {
                        "type": "number",
                        "description": "Target size in inches for the largest dimension"
                    }
                },
                "required": ["prompt"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_model_status",
            "description": "Check the status of a 3D model generation job.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {
                        "type": "string",
                        "description": "The job ID from generate_3d_model"
                    }
                },
                "required": ["job_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_printer_status",
            "description": "Get the current status of the Bambu P1S printer.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "start_print",
            "description": "Start printing a 3D model. ALWAYS confirm with user first!",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {
                        "type": "string",
                        "description": "The job ID of the model to print"
                    }
                },
                "required": ["job_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_print",
            "description": "Cancel the current print job.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    }
]


class PrintAssistant:
    """
    AI assistant for 3D model generation and printing.
    
    Manages conversation context and executes tool calls.
    """
    
    def __init__(self):
        settings = get_settings()
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.meshy = get_meshy_service()
        self.bridge = get_bridge_client()
        
        # In-memory job storage (replace with DB in production)
        self.jobs: dict[str, dict] = {}
    
    async def chat(
        self,
        message: str,
        conversation_history: list[dict],
        on_tool_call: Optional[Callable[[str, dict], Any]] = None
    ) -> tuple[str, list[dict]]:
        """
        Process a user message and return response.
        
        Args:
            message: User's message
            conversation_history: Previous messages
            on_tool_call: Optional callback for tool calls
        
        Returns:
            Tuple of (response_text, actions)
        """
        # Build messages
        messages = [
            {"role": "system", "content": ASSISTANT_INSTRUCTIONS}
        ]
        messages.extend(conversation_history)
        messages.append({"role": "user", "content": message})
        
        # Call OpenAI
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto"
        )
        
        assistant_message = response.choices[0].message
        actions = []
        
        # Handle tool calls
        if assistant_message.tool_calls:
            tool_results = []
            
            for tool_call in assistant_message.tool_calls:
                name = tool_call.function.name
                args = eval(tool_call.function.arguments)  # Safe since OpenAI controls format
                
                # Execute tool
                result = await self._execute_tool(name, args)
                
                tool_results.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "content": str(result)
                })
                
                # Track actions for UI
                if name == "generate_3d_model":
                    actions.append({
                        "type": "generating",
                        "job_id": result.get("job_id")
                    })
                elif name == "check_model_status" and result.get("status") == "ready":
                    actions.append({
                        "type": "show_preview",
                        "job_id": args.get("job_id"),
                        "model_url": result.get("model_url"),
                        "thumbnail_url": result.get("thumbnail_url")
                    })
                elif name == "start_print":
                    actions.append({
                        "type": "print_started",
                        "success": result.get("success", False)
                    })
                
                if on_tool_call:
                    on_tool_call(name, result)
            
            # Get final response with tool results
            messages.append(assistant_message.model_dump())
            messages.extend(tool_results)
            
            final_response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages
            )
            
            return final_response.choices[0].message.content, actions
        
        return assistant_message.content, actions
    
    async def _execute_tool(self, name: str, args: dict) -> dict:
        """Execute a tool and return result."""
        try:
            if name == "generate_3d_model":
                return await self._generate_model(
                    prompt=args["prompt"],
                    style=args.get("style", "cartoon"),
                    size_inches=args.get("size_inches", 6.0)
                )
            elif name == "check_model_status":
                return await self._check_status(args["job_id"])
            elif name == "get_printer_status":
                return await self._get_printer_status()
            elif name == "start_print":
                return await self._start_print(args["job_id"])
            elif name == "cancel_print":
                return await self._cancel_print()
            else:
                return {"error": f"Unknown tool: {name}"}
        except Exception as e:
            return {"error": str(e)}
    
    async def _generate_model(
        self,
        prompt: str,
        style: str,
        size_inches: float
    ) -> dict:
        """Generate a 3D model."""
        job_id = str(uuid.uuid4())
        
        # Store job
        self.jobs[job_id] = {
            "id": job_id,
            "prompt": prompt,
            "style": style,
            "target_size_mm": inches_to_mm(size_inches),
            "status": "generating",
            "progress": 0,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Start generation in background
        asyncio.create_task(self._run_generation(job_id))
        
        return {
            "job_id": job_id,
            "status": "generating",
            "message": f"Started generating your {style} model. This usually takes 2-3 minutes.",
            "estimated_time_seconds": 180
        }
    
    async def _run_generation(self, job_id: str):
        """Run model generation in background."""
        job = self.jobs.get(job_id)
        if not job:
            return
        
        try:
            # Generate with Meshy
            result = await self.meshy.generate_model(
                prompt=job["prompt"],
                style=job["style"],
                on_progress=lambda stage, pct: self._update_progress(job_id, stage, pct)
            )
            
            # Update job with results
            job.update({
                "status": "ready",
                "progress": 100,
                "model_url": result["model_urls"].get("glb"),
                "thumbnail_url": result["thumbnail_url"],
                "meshy_preview_id": result["preview_task_id"],
                "meshy_refine_id": result["refine_task_id"]
            })
            
        except MeshyError as e:
            job.update({
                "status": "failed",
                "error": str(e)
            })
        except Exception as e:
            job.update({
                "status": "failed",
                "error": f"Unexpected error: {e}"
            })
    
    def _update_progress(self, job_id: str, stage: str, percent: int):
        """Update job progress."""
        job = self.jobs.get(job_id)
        if job:
            # Preview is 0-50%, refine is 50-100%
            if stage == "preview":
                job["progress"] = percent // 2
            else:
                job["progress"] = 50 + (percent // 2)
    
    async def _check_status(self, job_id: str) -> dict:
        """Check model generation status."""
        job = self.jobs.get(job_id)
        if not job:
            return {"error": "Job not found"}
        
        return {
            "job_id": job_id,
            "status": job["status"],
            "progress": job.get("progress", 0),
            "model_url": job.get("model_url"),
            "thumbnail_url": job.get("thumbnail_url"),
            "error": job.get("error")
        }
    
    async def _get_printer_status(self) -> dict:
        """Get printer status from bridge."""
        try:
            status = await self.bridge.get_status()
            return {
                "state": status.state,
                "is_online": status.connected,
                "is_ready": status.connected and status.state in ("idle", "finish", "failed"),
                "current_job": status.job_name,
                "progress": status.progress if status.state == "running" else None,
                "remaining_minutes": status.remaining_minutes if status.state == "running" else None,
                "temperatures": {
                    "nozzle": status.nozzle_temp,
                    "bed": status.bed_temp,
                    "chamber": status.chamber_temp
                }
            }
        except BridgeError as e:
            return {
                "state": "offline",
                "is_online": False,
                "is_ready": False,
                "error": str(e)
            }
    
    async def _start_print(self, job_id: str) -> dict:
        """Start printing a model."""
        job = self.jobs.get(job_id)
        if not job:
            return {"success": False, "message": "Job not found"}
        
        if job["status"] != "ready":
            return {"success": False, "message": f"Model not ready: {job['status']}"}
        
        # Check printer
        try:
            if not await self.bridge.is_ready_to_print():
                return {"success": False, "message": "Printer not ready"}
        except BridgeError as e:
            return {"success": False, "message": str(e)}
        
        # In production: convert GLB to 3MF, upload, start print
        # For now, just mark as printing
        job["status"] = "printing"
        job["print_started_at"] = datetime.utcnow().isoformat()
        
        return {
            "success": True,
            "message": "Print started! I'll monitor progress and let you know when it's done."
        }
    
    async def _cancel_print(self) -> dict:
        """Cancel current print."""
        try:
            await self.bridge.stop_print()
            return {"success": True, "message": "Print cancelled"}
        except BridgeError as e:
            return {"success": False, "message": str(e)}


# Singleton
_assistant: Optional[PrintAssistant] = None


def get_assistant() -> PrintAssistant:
    """Get assistant singleton."""
    global _assistant
    if _assistant is None:
        _assistant = PrintAssistant()
    return _assistant
