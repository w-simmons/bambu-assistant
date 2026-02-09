# Bambu Assistant - Technical Specification

AI-powered 3D printing assistant that designs and prints toys/objects via natural language.

**Version:** 0.1.0  
**Last Updated:** 2026-02-08  
**Status:** Design Phase

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [3D Generation Pipeline (Meshy)](#3d-generation-pipeline-meshy)
4. [Printer Integration (Bambu P1S)](#printer-integration-bambu-p1s)
5. [File Conversion Pipeline](#file-conversion-pipeline)
6. [AI Agent Design](#ai-agent-design)
7. [Database Schema](#database-schema)
8. [API Specification](#api-specification)
9. [Frontend Architecture](#frontend-architecture)
10. [Error Handling](#error-handling)
11. [Development Phases](#development-phases)
12. [Environment & Deployment](#environment--deployment)

---

## System Overview

### Problem Statement
Creating 3D printable objects requires:
1. 3D modeling skills (CAD software)
2. Understanding of print constraints
3. Slicing configuration knowledge
4. Printer operation experience

### Solution
Natural language interface that handles the entire pipeline:
```
"Make a 6-inch T-Rex toy for my kid, cartoon style"
    ↓
AI generates clarifying questions
    ↓
Meshy API creates 3D model
    ↓
User previews in browser (Three.js)
    ↓
Model converted to print-ready format
    ↓
Sent to Bambu P1S via local network
    ↓
Real-time print monitoring
```

### Key Constraints
- **Local-first**: Printer control via LAN, no cloud dependency
- **Cost-effective**: ~$0.15-0.30 per model generation
- **Print-safe**: All models validated for printability
- **Kid-friendly outputs**: Focus on toys, animals, simple objects

---

## Architecture

### High-Level System Diagram
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js 15)                          │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │  Chat UI    │  │  3D Viewer      │  │  Print      │  │  History      │  │
│  │  - Messages │  │  - Three.js     │  │  Confirm    │  │  - Past jobs  │  │
│  │  - Input    │  │  - OrbitControl │  │  - Preview  │  │  - Re-print   │  │
│  │  - Status   │  │  - GLB loader   │  │  - Estimate │  │  - Thumbnails │  │
│  └─────────────┘  └─────────────────┘  └─────────────┘  └───────────────┘  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ HTTP/WebSocket
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Python FastAPI)                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        API Layer (FastAPI)                           │   │
│  │  /chat  /jobs  /jobs/{id}/confirm  /printer/status  /models/{id}    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────┐  ┌────────────────┴───────────────┐  ┌─────────────────┐  │
│  │  AI Agent   │  │     Service Layer              │  │  Background     │  │
│  │  (OpenAI)   │  │  ┌───────────┐ ┌────────────┐  │  │  Workers        │  │
│  │             │  │  │  Meshy    │ │  Bambu     │  │  │  - Poll Meshy   │  │
│  │  Tools:     │  │  │  Service  │ │  Service   │  │  │  - Monitor      │  │
│  │  -generate  │  │  └───────────┘ └────────────┘  │  │    printer      │  │
│  │  -status    │  │  ┌───────────┐ ┌────────────┐  │  │  - Convert      │  │
│  │  -print     │  │  │  Convert  │ │  Storage   │  │  │    models       │  │
│  │  -cancel    │  │  │  Service  │ │  Service   │  │  └─────────────────┘  │
│  └─────────────┘  │  └───────────┘ └────────────┘  │                       │
│                   └────────────────────────────────┘                       │
│                                    │                                        │
│  ┌─────────────────────────────────┴───────────────────────────────────┐   │
│  │                      Database (PostgreSQL/Neon)                      │   │
│  │  print_jobs | conversations | users | model_cache                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
   ┌─────────────┐       ┌─────────────┐       ┌─────────────────┐
   │  OpenAI     │       │  Meshy API  │       │  Bambu P1S      │
   │  API        │       │             │       │  (Local LAN)    │
   │             │       │  Text→3D    │       │                 │
   │  GPT-4o     │       │  GLB/STL    │       │  MQTT :8883     │
   │  Tool calls │       │  ~2min gen  │       │  FTPS :990      │
   └─────────────┘       └─────────────┘       │  Camera :6000   │
                                               └─────────────────┘
```

### Technology Decisions

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Frontend Framework | Next.js 15 (App Router) | SSR, React Server Components, consistent with other projects |
| 3D Rendering | Three.js + @react-three/fiber | Industry standard WebGL, excellent GLB support |
| 3D Controls | @react-three/drei | OrbitControls, Environment, Stage helpers |
| Backend Framework | FastAPI | Async support, OpenAPI docs, Python ecosystem |
| AI Framework | OpenAI Agents SDK | Native tool calling, conversation management |
| LLM | GPT-4o | Best balance of speed/quality for tool use |
| 3D Generation | Meshy API | Best quality for organic shapes, good API |
| Database | PostgreSQL (Neon) | Serverless, Vercel integration |
| File Storage | Vercel Blob or S3 | CDN-backed model storage |
| Printer Protocol | MQTT + FTPS | Direct LAN control, no cloud dependency |

---

## 3D Generation Pipeline (Meshy)

### API Overview

**Base URL:** `https://api.meshy.ai`  
**Auth:** Bearer token in `Authorization` header  
**Docs:** https://docs.meshy.ai

### Authentication
```python
import httpx

MESHY_API_KEY = os.environ["MESHY_API_KEY"]  # Format: msy_xxxxxxxxxxxx

headers = {
    "Authorization": f"Bearer {MESHY_API_KEY}",
    "Content-Type": "application/json"
}
```

### Text-to-3D Workflow

The Meshy pipeline has two stages:

#### Stage 1: Preview (Geometry Generation)
Creates untextured base mesh. Cost: 20 credits (~$0.10)

```python
# POST https://api.meshy.ai/openapi/v2/text-to-3d

async def create_preview_task(prompt: str, style: str = "cartoon") -> str:
    """
    Create a preview task for geometry generation.
    
    Args:
        prompt: Detailed description of the 3D model
        style: "realistic" | "cartoon" | "sculpture"
    
    Returns:
        task_id: UUID for polling status
    """
    payload = {
        "mode": "preview",
        "prompt": prompt,
        "ai_model": "meshy-6",  # Latest model
        "topology": "quad",     # Better for 3D printing
        "target_polycount": 50000,  # Balance detail vs print time
        "should_remesh": True,
        "symmetry_mode": "auto"
    }
    
    # Optional: For characters/figures
    if "character" in prompt.lower() or "figure" in prompt.lower():
        payload["pose_mode"] = "a-pose"  # Better for rigging/printing
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.meshy.ai/openapi/v2/text-to-3d",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        return response.json()["result"]  # Returns task_id

# Example response:
# {"result": "0192bd0b-a932-7f0a-b3a8-71ef5d6d65f0"}
```

#### Stage 2: Refine (Texture Generation)
Applies textures to preview mesh. Cost: 10 credits (~$0.05)

```python
# POST https://api.meshy.ai/openapi/v2/text-to-3d

async def create_refine_task(preview_task_id: str, texture_prompt: str = None) -> str:
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
        "enable_pbr": True,  # Generate PBR maps (metallic, roughness, normal)
    }
    
    if texture_prompt:
        payload["texture_prompt"] = texture_prompt
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.meshy.ai/openapi/v2/text-to-3d",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        return response.json()["result"]
```

#### Polling Task Status

```python
# GET https://api.meshy.ai/openapi/v2/text-to-3d/{task_id}

from enum import Enum
from dataclasses import dataclass
from typing import Optional

class TaskStatus(Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"

@dataclass
class MeshyTask:
    id: str
    status: TaskStatus
    progress: int  # 0-100
    model_urls: Optional[dict] = None  # Available when SUCCEEDED
    thumbnail_url: Optional[str] = None
    error: Optional[str] = None

async def get_task_status(task_id: str) -> MeshyTask:
    """Poll task status until completion."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.meshy.ai/openapi/v2/text-to-3d/{task_id}",
            headers=headers
        )
        response.raise_for_status()
        data = response.json()
        
        return MeshyTask(
            id=data["id"],
            status=TaskStatus(data["status"]),
            progress=data.get("progress", 0),
            model_urls=data.get("model_urls"),
            thumbnail_url=data.get("thumbnail_url"),
            error=data.get("task_error", {}).get("message")
        )

# Example successful response:
# {
#     "id": "0192bd0b-a932-7f0a-b3a8-71ef5d6d65f0",
#     "status": "SUCCEEDED",
#     "progress": 100,
#     "model_urls": {
#         "glb": "https://assets.meshy.ai/.../model.glb",
#         "fbx": "https://assets.meshy.ai/.../model.fbx",
#         "obj": "https://assets.meshy.ai/.../model.obj",
#         "usdz": "https://assets.meshy.ai/.../model.usdz"
#     },
#     "thumbnail_url": "https://assets.meshy.ai/.../thumbnail.png"
# }
```

#### Complete Generation Flow

```python
import asyncio

async def generate_3d_model(
    prompt: str,
    texture_prompt: str = None,
    poll_interval: float = 5.0,
    timeout: float = 300.0
) -> dict:
    """
    Complete flow to generate a 3D model from text.
    
    Args:
        prompt: Description of the model
        texture_prompt: Optional texture guidance
        poll_interval: Seconds between status checks
        timeout: Maximum wait time in seconds
    
    Returns:
        dict with model_urls, thumbnail_url
    
    Raises:
        TimeoutError: If generation exceeds timeout
        MeshyError: If generation fails
    """
    start_time = asyncio.get_event_loop().time()
    
    # Stage 1: Preview
    preview_task_id = await create_preview_task(prompt)
    
    while True:
        if asyncio.get_event_loop().time() - start_time > timeout:
            raise TimeoutError(f"Preview generation timed out after {timeout}s")
        
        status = await get_task_status(preview_task_id)
        
        if status.status == TaskStatus.SUCCEEDED:
            break
        elif status.status == TaskStatus.FAILED:
            raise MeshyError(f"Preview failed: {status.error}")
        
        await asyncio.sleep(poll_interval)
    
    # Stage 2: Refine
    refine_task_id = await create_refine_task(preview_task_id, texture_prompt)
    
    while True:
        if asyncio.get_event_loop().time() - start_time > timeout:
            raise TimeoutError(f"Refine generation timed out after {timeout}s")
        
        status = await get_task_status(refine_task_id)
        
        if status.status == TaskStatus.SUCCEEDED:
            return {
                "preview_task_id": preview_task_id,
                "refine_task_id": refine_task_id,
                "model_urls": status.model_urls,
                "thumbnail_url": status.thumbnail_url
            }
        elif status.status == TaskStatus.FAILED:
            raise MeshyError(f"Refine failed: {status.error}")
        
        await asyncio.sleep(poll_interval)
```

### Prompt Engineering for Printable Models

```python
def enhance_prompt_for_printing(user_prompt: str, size_inches: float = 6.0) -> str:
    """
    Enhance user prompt with printing-friendly guidance.
    """
    enhancements = [
        "solid base for stability",
        "no thin overhanging parts",
        "minimum wall thickness 2mm",
        "suitable for FDM 3D printing",
        f"proportioned for {size_inches} inch final print"
    ]
    
    return f"{user_prompt}, {', '.join(enhancements)}"

# Example:
# Input: "cute cartoon dinosaur"
# Output: "cute cartoon dinosaur, solid base for stability, no thin overhanging parts, 
#          minimum wall thickness 2mm, suitable for FDM 3D printing, proportioned for 6 inch final print"
```

### Cost Estimation

| Operation | Credits | USD (approx) |
|-----------|---------|--------------|
| Preview (Meshy-6) | 20 | $0.10 |
| Refine | 10 | $0.05 |
| **Total per model** | **30** | **$0.15** |

Credit packs: 200 credits = $10, 1000 credits = $40

---

## Printer Integration (Bambu P1S)

### Connection Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BAMBU P1S PRINTER                           │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   MQTT Broker    │  │   FTP Server     │  │  Camera Stream   │  │
│  │   Port 8883      │  │   Port 990       │  │  Port 6000       │  │
│  │   TLS Required   │  │   Implicit TLS   │  │  TLS Required    │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                     │            │
│  ┌────────┴─────────────────────┴─────────────────────┴────────┐   │
│  │                    Printer Controller                        │   │
│  │  - Print queue management                                    │   │
│  │  - Temperature control                                       │   │
│  │  - Motion system                                             │   │
│  │  - AMS (filament system)                                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
         │                     │                     │
         │ MQTT                │ FTPS                │ TCP/TLS
         │ (commands/status)   │ (file upload)       │ (JPEG stream)
         ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BAMBU SERVICE (Python)                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  MQTTClient      │  │  FTPSClient      │  │  CameraClient    │  │
│  │  - Subscribe     │  │  - Upload .3mf   │  │  - JPEG decode   │  │
│  │  - Publish cmds  │  │  - List files    │  │  - Frame buffer  │  │
│  │  - Parse status  │  │  - Delete        │  │                  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Credentials & Discovery

```python
from dataclasses import dataclass

@dataclass
class BambuCredentials:
    """
    Credentials required for P1S connection.
    
    How to find these:
    1. Serial Number: Printer LCD → Settings → Device Info
       Format: "01S00A123456789" (starts with printer model code)
    
    2. IP Address: Printer LCD → Settings → Network → LAN
       Or check router DHCP leases for "Bambu" device
    
    3. Access Code: Printer LCD → Settings → Network → LAN Mode
       8-character alphanumeric code, regenerates if LAN mode toggled
    """
    serial_number: str  # e.g., "01S00A123456789"
    ip_address: str     # e.g., "192.168.1.100"
    access_code: str    # e.g., "12345678"
    
    @property
    def mqtt_username(self) -> str:
        return "bblp"
    
    @property
    def mqtt_password(self) -> str:
        return self.access_code
    
    @property
    def mqtt_topic_subscribe(self) -> str:
        return f"device/{self.serial_number}/report"
    
    @property
    def mqtt_topic_publish(self) -> str:
        return f"device/{self.serial_number}/request"
```

### MQTT Client Implementation

```python
import ssl
import json
import asyncio
from typing import Callable, Optional
import paho.mqtt.client as mqtt

class BambuMQTTClient:
    """
    MQTT client for Bambu P1S printer communication.
    
    Protocol details:
    - Port: 8883 (MQTT over TLS)
    - TLS: Required, but certificate verification often disabled for local
    - QoS: 0 for status, 1 for commands
    - Keepalive: 5 seconds recommended
    """
    
    def __init__(self, credentials: BambuCredentials):
        self.credentials = credentials
        self.client: Optional[mqtt.Client] = None
        self._status_callback: Optional[Callable] = None
        self._connected = asyncio.Event()
        self._latest_status: dict = {}
    
    def _create_tls_context(self) -> ssl.SSLContext:
        """Create TLS context with verification disabled for local printer."""
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    
    def _on_connect(self, client, userdata, flags, rc):
        """Handle MQTT connection."""
        if rc == 0:
            # Subscribe to printer status reports
            client.subscribe(self.credentials.mqtt_topic_subscribe, qos=0)
            self._connected.set()
        else:
            raise ConnectionError(f"MQTT connection failed with code {rc}")
    
    def _on_message(self, client, userdata, msg):
        """Handle incoming printer status messages."""
        try:
            payload = json.loads(msg.payload.decode())
            self._latest_status = payload
            
            if self._status_callback:
                self._status_callback(payload)
        except json.JSONDecodeError:
            pass  # Ignore malformed messages
    
    async def connect(self):
        """Establish MQTT connection to printer."""
        self.client = mqtt.Client(
            client_id=f"bambu_assistant_{self.credentials.serial_number}",
            protocol=mqtt.MQTTv311
        )
        
        self.client.username_pw_set(
            self.credentials.mqtt_username,
            self.credentials.mqtt_password
        )
        self.client.tls_set_context(self._create_tls_context())
        
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        
        self.client.connect_async(
            self.credentials.ip_address,
            port=8883,
            keepalive=5
        )
        self.client.loop_start()
        
        # Wait for connection
        await asyncio.wait_for(self._connected.wait(), timeout=10.0)
    
    async def disconnect(self):
        """Disconnect from printer."""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
    
    def send_command(self, command: dict):
        """
        Send command to printer.
        
        Args:
            command: Command dictionary (see command reference below)
        """
        if not self.client or not self._connected.is_set():
            raise RuntimeError("Not connected to printer")
        
        payload = json.dumps(command)
        self.client.publish(
            self.credentials.mqtt_topic_publish,
            payload,
            qos=1
        )
    
    def on_status(self, callback: Callable[[dict], None]):
        """Register callback for status updates."""
        self._status_callback = callback
    
    @property
    def status(self) -> dict:
        """Get latest printer status."""
        return self._latest_status
```

### MQTT Command Reference

```python
class BambuCommands:
    """
    Command templates for Bambu P1S.
    
    All commands include sequence_id for request tracking.
    Printer responds on report topic with matching sequence_id.
    """
    
    @staticmethod
    def push_all() -> dict:
        """Request full status dump from printer."""
        return {
            "pushing": {
                "sequence_id": "0",
                "command": "pushall"
            }
        }
    
    @staticmethod
    def start_print(
        filename: str,
        plate_number: int = 1,
        use_ams: bool = False,
        timelapse: bool = False,
        bed_leveling: bool = True,
        flow_calibration: bool = False,
        vibration_calibration: bool = False
    ) -> dict:
        """
        Start a print job.
        
        Args:
            filename: Name of .3mf file (already uploaded via FTP)
            plate_number: Which plate to print (1-indexed)
            use_ams: Use AMS filament system
            timelapse: Record timelapse video
            bed_leveling: Run bed leveling before print
            flow_calibration: Run flow calibration
            vibration_calibration: Run vibration calibration
        
        Note: File must be uploaded to printer via FTPS first.
        The URL format is: ftp://{ip_address}/{filename}
        """
        return {
            "print": {
                "sequence_id": "0",
                "command": "project_file",
                "param": f"Metadata/plate_{plate_number}.gcode",
                "subtask_name": filename.replace(".3mf", ""),
                "url": f"ftp://{filename}",  # Relative to FTP root
                "timelapse": timelapse,
                "bed_leveling": bed_leveling,
                "flow_cali": flow_calibration,
                "vibration_cali": vibration_calibration,
                "layer_inspect": False,
                "use_ams": use_ams
            }
        }
    
    @staticmethod
    def pause_print() -> dict:
        """Pause current print job."""
        return {
            "print": {
                "sequence_id": "0",
                "command": "pause"
            }
        }
    
    @staticmethod
    def resume_print() -> dict:
        """Resume paused print job."""
        return {
            "print": {
                "sequence_id": "0",
                "command": "resume"
            }
        }
    
    @staticmethod
    def stop_print() -> dict:
        """Stop/cancel current print job."""
        return {
            "print": {
                "sequence_id": "0",
                "command": "stop"
            }
        }
    
    @staticmethod
    def set_bed_temperature(temp: int) -> dict:
        """Set bed temperature (0 to turn off)."""
        return {
            "print": {
                "sequence_id": "0",
                "command": "gcode_line",
                "param": f"M140 S{temp}"
            }
        }
    
    @staticmethod
    def set_nozzle_temperature(temp: int) -> dict:
        """Set nozzle temperature (0 to turn off)."""
        return {
            "print": {
                "sequence_id": "0",
                "command": "gcode_line",
                "param": f"M104 S{temp}"
            }
        }
    
    @staticmethod
    def set_chamber_light(on: bool) -> dict:
        """Turn chamber light on/off."""
        return {
            "system": {
                "sequence_id": "0",
                "command": "ledctrl",
                "led_node": "chamber_light",
                "led_mode": "on" if on else "off"
            }
        }
    
    @staticmethod
    def get_version() -> dict:
        """Request firmware version info."""
        return {
            "info": {
                "sequence_id": "0",
                "command": "get_version"
            }
        }
```

### MQTT Status Payload Structure

```python
from dataclasses import dataclass
from enum import Enum
from typing import Optional

class PrinterState(Enum):
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    PAUSE = "PAUSE"
    FINISH = "FINISH"
    FAILED = "FAILED"
    PREPARE = "PREPARE"
    SLICING = "SLICING"

@dataclass
class PrinterStatus:
    """
    Parsed printer status from MQTT report.
    
    Raw payload structure (partial):
    {
        "print": {
            "gcode_state": "RUNNING",
            "mc_percent": 45,
            "mc_remaining_time": 3600,
            "subtask_name": "dinosaur",
            "layer_num": 42,
            "total_layer_num": 200,
            "gcode_file": "dinosaur.3mf",
            "wifi_signal": "-52dBm",
            "nozzle_temper": 220.0,
            "nozzle_target_temper": 220.0,
            "bed_temper": 60.0,
            "bed_target_temper": 60.0,
            "chamber_temper": 35.0,
            "fan_gear": 15,
            "big_fan1_speed": "100%",
            "big_fan2_speed": "100%",
            "cooling_fan_speed": "100%",
            "heatbreak_fan_speed": "100%"
        },
        "lights_report": [
            {"node": "chamber_light", "mode": "on"}
        ],
        "ams": {
            "ams": [...],  # AMS unit status
            "tray_now": "0"
        }
    }
    """
    state: PrinterState
    progress_percent: int
    remaining_time_seconds: int
    current_layer: int
    total_layers: int
    job_name: str
    
    nozzle_temp: float
    nozzle_target: float
    bed_temp: float
    bed_target: float
    chamber_temp: float
    
    wifi_signal: str
    light_on: bool
    
    @classmethod
    def from_mqtt_payload(cls, payload: dict) -> "PrinterStatus":
        """Parse raw MQTT payload into PrinterStatus."""
        print_data = payload.get("print", {})
        lights = payload.get("lights_report", [])
        
        light_on = any(
            l.get("node") == "chamber_light" and l.get("mode") == "on"
            for l in lights
        )
        
        return cls(
            state=PrinterState(print_data.get("gcode_state", "IDLE")),
            progress_percent=print_data.get("mc_percent", 0),
            remaining_time_seconds=print_data.get("mc_remaining_time", 0),
            current_layer=print_data.get("layer_num", 0),
            total_layers=print_data.get("total_layer_num", 0),
            job_name=print_data.get("subtask_name", ""),
            nozzle_temp=print_data.get("nozzle_temper", 0.0),
            nozzle_target=print_data.get("nozzle_target_temper", 0.0),
            bed_temp=print_data.get("bed_temper", 0.0),
            bed_target=print_data.get("bed_target_temper", 0.0),
            chamber_temp=print_data.get("chamber_temper", 0.0),
            wifi_signal=print_data.get("wifi_signal", ""),
            light_on=light_on
        )
```

### FTPS File Upload

```python
import ftplib
import ssl
from pathlib import Path

class BambuFTPSClient:
    """
    FTPS client for uploading print files to Bambu P1S.
    
    Protocol details:
    - Port: 990 (Implicit FTPS)
    - TLS: Required from connection start
    - Passive mode: Required
    - Root directory: Printer's internal storage
    """
    
    def __init__(self, credentials: BambuCredentials):
        self.credentials = credentials
        self.ftp: Optional[ftplib.FTP_TLS] = None
    
    def _create_implicit_ftps(self) -> ftplib.FTP_TLS:
        """Create FTPS connection with implicit TLS (port 990)."""
        # Custom class for implicit FTPS
        class ImplicitFTPS(ftplib.FTP_TLS):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self._sock = None
            
            @property
            def sock(self):
                return self._sock
            
            @sock.setter
            def sock(self, value):
                if value and not isinstance(value, ssl.SSLSocket):
                    value = self.context.wrap_socket(value)
                self._sock = value
        
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        ftp = ImplicitFTPS(context=ctx)
        ftp.connect(self.credentials.ip_address, port=990, timeout=30)
        ftp.login(self.credentials.mqtt_username, self.credentials.mqtt_password)
        ftp.prot_p()  # Enable data connection protection
        ftp.set_pasv(True)  # Passive mode required
        
        return ftp
    
    def connect(self):
        """Establish FTPS connection."""
        self.ftp = self._create_implicit_ftps()
    
    def disconnect(self):
        """Close FTPS connection."""
        if self.ftp:
            try:
                self.ftp.quit()
            except:
                self.ftp.close()
    
    def upload_file(self, local_path: Path, remote_filename: str = None) -> str:
        """
        Upload a file to the printer.
        
        Args:
            local_path: Path to local .3mf file
            remote_filename: Optional remote filename (defaults to local name)
        
        Returns:
            Remote filename for use in print command
        """
        if not self.ftp:
            raise RuntimeError("Not connected")
        
        remote_filename = remote_filename or local_path.name
        
        with open(local_path, "rb") as f:
            self.ftp.storbinary(f"STOR {remote_filename}", f)
        
        return remote_filename
    
    def list_files(self) -> list[str]:
        """List files on printer."""
        if not self.ftp:
            raise RuntimeError("Not connected")
        return self.ftp.nlst()
    
    def delete_file(self, filename: str):
        """Delete a file from printer."""
        if not self.ftp:
            raise RuntimeError("Not connected")
        self.ftp.delete(filename)
```

### Complete Print Workflow

```python
async def print_model(
    credentials: BambuCredentials,
    model_path: Path,
    job_name: str
) -> str:
    """
    Complete workflow to print a 3D model.
    
    Args:
        credentials: Printer credentials
        model_path: Path to .3mf file
        job_name: Name for the print job
    
    Returns:
        Job ID for tracking
    """
    # 1. Upload file via FTPS
    ftp_client = BambuFTPSClient(credentials)
    ftp_client.connect()
    
    try:
        remote_filename = f"{job_name}.3mf"
        ftp_client.upload_file(model_path, remote_filename)
    finally:
        ftp_client.disconnect()
    
    # 2. Connect MQTT and start print
    mqtt_client = BambuMQTTClient(credentials)
    await mqtt_client.connect()
    
    try:
        # Request full status first
        mqtt_client.send_command(BambuCommands.push_all())
        await asyncio.sleep(1)
        
        # Verify printer is idle
        status = PrinterStatus.from_mqtt_payload(mqtt_client.status)
        if status.state != PrinterState.IDLE:
            raise RuntimeError(f"Printer not idle: {status.state}")
        
        # Start print
        mqtt_client.send_command(
            BambuCommands.start_print(
                filename=remote_filename,
                bed_leveling=True,
                timelapse=False
            )
        )
        
        return job_name
    finally:
        await mqtt_client.disconnect()
```

### Firmware Compatibility

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIRMWARE COMPATIBILITY MATRIX                        │
├─────────────────┬───────────────────┬───────────────────────────────────────┤
│ Firmware        │ Read Access       │ Write Access                          │
├─────────────────┼───────────────────┼───────────────────────────────────────┤
│ < 01.08.02.00   │ ✅ Full           │ ✅ Full                               │
├─────────────────┼───────────────────┼───────────────────────────────────────┤
│ ≥ 01.08.02.00   │ ✅ Full           │ ⚠️  Cloud connected: Light only       │
│ (Cloud mode)    │                   │                                       │
├─────────────────┼───────────────────┼───────────────────────────────────────┤
│ ≥ 01.08.02.00   │ ✅ Full           │ ✅ Full                               │
│ (Developer LAN) │                   │                                       │
└─────────────────┴───────────────────┴───────────────────────────────────────┘

To enable Developer LAN Mode:
1. Printer LCD → Settings → Network → LAN Mode → Enable
2. Toggle "Developer Mode" switch
3. Note: This disables Bambu Cloud connectivity (Handy app, remote monitoring)

Recommendation: Use Developer LAN Mode for this project since we need full control.
```

---

## File Conversion Pipeline

### Overview

Meshy outputs GLB (GL Transmission Format Binary), but Bambu printers require 3MF (3D Manufacturing Format). The conversion pipeline:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Meshy     │────▶│    GLB      │────▶│   Trimesh   │────▶│    3MF      │
│   API       │     │   (web)     │     │   Process   │     │  (printer)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                    │
                          │                    ├── Scale to target size
                          │                    ├── Center on build plate
                          │                    ├── Validate printability
                          │                    └── Add print settings
                          │
                          └── Also used for Three.js preview
```

### Trimesh Implementation

```python
import trimesh
import numpy as np
from pathlib import Path
from dataclasses import dataclass
from typing import Optional
import tempfile
import httpx

@dataclass
class ModelDimensions:
    """Model bounding box dimensions in mm."""
    width: float   # X axis
    depth: float   # Y axis  
    height: float  # Z axis
    
    @property
    def max_dimension(self) -> float:
        return max(self.width, self.depth, self.height)

@dataclass
class ConversionResult:
    """Result of GLB to 3MF conversion."""
    output_path: Path
    dimensions: ModelDimensions
    triangle_count: int
    is_watertight: bool
    warnings: list[str]

class ModelConverter:
    """
    Convert GLB models to print-ready 3MF format.
    
    Key operations:
    1. Load GLB mesh
    2. Scale to target size
    3. Center on build plate
    4. Validate geometry
    5. Export as 3MF
    """
    
    # Bambu P1S build volume (mm)
    BUILD_PLATE_X = 256
    BUILD_PLATE_Y = 256
    BUILD_PLATE_Z = 256
    
    def __init__(self):
        self.warnings: list[str] = []
    
    async def download_model(self, url: str) -> Path:
        """Download GLB model from URL to temp file."""
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            
            temp_file = tempfile.NamedTemporaryFile(
                suffix=".glb",
                delete=False
            )
            temp_file.write(response.content)
            temp_file.close()
            
            return Path(temp_file.name)
    
    def load_glb(self, path: Path) -> trimesh.Trimesh:
        """
        Load GLB file and extract mesh.
        
        GLB files can contain scenes with multiple meshes.
        We combine them into a single mesh for printing.
        """
        scene = trimesh.load(str(path))
        
        if isinstance(scene, trimesh.Scene):
            # Combine all meshes in scene
            meshes = []
            for name, geometry in scene.geometry.items():
                if isinstance(geometry, trimesh.Trimesh):
                    meshes.append(geometry)
            
            if not meshes:
                raise ValueError("No valid meshes found in GLB")
            
            mesh = trimesh.util.concatenate(meshes)
        elif isinstance(scene, trimesh.Trimesh):
            mesh = scene
        else:
            raise ValueError(f"Unexpected type: {type(scene)}")
        
        return mesh
    
    def get_dimensions(self, mesh: trimesh.Trimesh) -> ModelDimensions:
        """Get mesh bounding box dimensions."""
        bounds = mesh.bounds
        size = bounds[1] - bounds[0]
        
        return ModelDimensions(
            width=float(size[0]),
            depth=float(size[1]),
            height=float(size[2])
        )
    
    def scale_to_size(
        self,
        mesh: trimesh.Trimesh,
        target_size_mm: float,
        dimension: str = "max"
    ) -> trimesh.Trimesh:
        """
        Scale mesh so target dimension equals target_size_mm.
        
        Args:
            mesh: Input mesh
            target_size_mm: Desired size in millimeters
            dimension: Which dimension to target ("max", "height", "width", "depth")
        """
        dims = self.get_dimensions(mesh)
        
        if dimension == "max":
            current = dims.max_dimension
        elif dimension == "height":
            current = dims.height
        elif dimension == "width":
            current = dims.width
        elif dimension == "depth":
            current = dims.depth
        else:
            raise ValueError(f"Unknown dimension: {dimension}")
        
        if current == 0:
            raise ValueError("Mesh has zero size")
        
        scale_factor = target_size_mm / current
        
        # Apply uniform scale
        mesh.apply_scale(scale_factor)
        
        return mesh
    
    def center_on_build_plate(self, mesh: trimesh.Trimesh) -> trimesh.Trimesh:
        """
        Center mesh on build plate with bottom at Z=0.
        """
        # Get current bounds
        bounds = mesh.bounds
        
        # Calculate translation to center XY and place bottom at Z=0
        center_x = (bounds[0][0] + bounds[1][0]) / 2
        center_y = (bounds[0][1] + bounds[1][1]) / 2
        min_z = bounds[0][2]
        
        translation = [
            self.BUILD_PLATE_X / 2 - center_x,
            self.BUILD_PLATE_Y / 2 - center_y,
            -min_z  # Move bottom to Z=0
        ]
        
        mesh.apply_translation(translation)
        
        return mesh
    
    def validate_printability(self, mesh: trimesh.Trimesh) -> list[str]:
        """
        Check mesh for common printing issues.
        
        Returns list of warnings (empty if all good).
        """
        warnings = []
        
        # Check if watertight (manifold)
        if not mesh.is_watertight:
            warnings.append("Mesh is not watertight - may have holes")
        
        # Check for inverted normals
        if mesh.is_winding_consistent is False:
            warnings.append("Inconsistent face winding - normals may be inverted")
        
        # Check minimum thickness (approximate)
        # This is a rough heuristic - proper analysis would require ray casting
        dims = self.get_dimensions(mesh)
        min_dim = min(dims.width, dims.depth, dims.height)
        if min_dim < 1.0:  # Less than 1mm
            warnings.append(f"Very thin dimension ({min_dim:.2f}mm) - may not print well")
        
        # Check if fits build plate
        if dims.width > self.BUILD_PLATE_X:
            warnings.append(f"Model too wide ({dims.width:.1f}mm > {self.BUILD_PLATE_X}mm)")
        if dims.depth > self.BUILD_PLATE_Y:
            warnings.append(f"Model too deep ({dims.depth:.1f}mm > {self.BUILD_PLATE_Y}mm)")
        if dims.height > self.BUILD_PLATE_Z:
            warnings.append(f"Model too tall ({dims.height:.1f}mm > {self.BUILD_PLATE_Z}mm)")
        
        # Check triangle count (too high = slow slicing)
        if mesh.faces.shape[0] > 500000:
            warnings.append(f"High triangle count ({mesh.faces.shape[0]}) - consider simplifying")
        
        return warnings
    
    def repair_mesh(self, mesh: trimesh.Trimesh) -> trimesh.Trimesh:
        """
        Attempt to repair common mesh issues.
        """
        # Fill holes
        if not mesh.is_watertight:
            trimesh.repair.fill_holes(mesh)
        
        # Fix winding
        trimesh.repair.fix_winding(mesh)
        
        # Fix normals
        trimesh.repair.fix_normals(mesh)
        
        # Remove degenerate faces
        mesh.remove_degenerate_faces()
        
        # Remove duplicate faces
        mesh.remove_duplicate_faces()
        
        return mesh
    
    def export_3mf(self, mesh: trimesh.Trimesh, output_path: Path):
        """
        Export mesh as 3MF file.
        
        3MF is a ZIP-based format containing:
        - 3D/3dmodel.model (XML mesh data)
        - [Content_Types].xml
        - _rels/.rels
        """
        mesh.export(str(output_path), file_type="3mf")
    
    async def convert(
        self,
        glb_url: str,
        output_path: Path,
        target_size_mm: float = 150.0,
        auto_repair: bool = True
    ) -> ConversionResult:
        """
        Complete conversion pipeline.
        
        Args:
            glb_url: URL to GLB file (from Meshy)
            output_path: Where to save 3MF
            target_size_mm: Target size for largest dimension
            auto_repair: Attempt to fix mesh issues
        
        Returns:
            ConversionResult with dimensions and warnings
        """
        self.warnings = []
        
        # Download GLB
        glb_path = await self.download_model(glb_url)
        
        try:
            # Load mesh
            mesh = self.load_glb(glb_path)
            
            # Repair if requested
            if auto_repair:
                mesh = self.repair_mesh(mesh)
            
            # Scale to target size
            mesh = self.scale_to_size(mesh, target_size_mm)
            
            # Center on build plate
            mesh = self.center_on_build_plate(mesh)
            
            # Validate
            warnings = self.validate_printability(mesh)
            self.warnings.extend(warnings)
            
            # Get final dimensions
            dimensions = self.get_dimensions(mesh)
            
            # Export
            self.export_3mf(mesh, output_path)
            
            return ConversionResult(
                output_path=output_path,
                dimensions=dimensions,
                triangle_count=mesh.faces.shape[0],
                is_watertight=mesh.is_watertight,
                warnings=self.warnings
            )
        
        finally:
            # Clean up temp file
            glb_path.unlink(missing_ok=True)
```

### Size Conversion Utilities

```python
def inches_to_mm(inches: float) -> float:
    """Convert inches to millimeters."""
    return inches * 25.4

def mm_to_inches(mm: float) -> float:
    """Convert millimeters to inches."""
    return mm / 25.4

def parse_size_request(text: str) -> Optional[float]:
    """
    Parse size from natural language.
    
    Examples:
        "6 inches" -> 152.4 mm
        "15 cm" -> 150.0 mm
        "100mm" -> 100.0 mm
        "about 8 inches tall" -> 203.2 mm
    """
    import re
    
    # Try inches
    match = re.search(r'(\d+(?:\.\d+)?)\s*(?:inch|inches|in|")', text.lower())
    if match:
        return inches_to_mm(float(match.group(1)))
    
    # Try centimeters
    match = re.search(r'(\d+(?:\.\d+)?)\s*(?:cm|centimeter|centimeters)', text.lower())
    if match:
        return float(match.group(1)) * 10
    
    # Try millimeters
    match = re.search(r'(\d+(?:\.\d+)?)\s*(?:mm|millimeter|millimeters)', text.lower())
    if match:
        return float(match.group(1))
    
    return None
```

---

## AI Agent Design

### Agent Architecture

```python
from openai import OpenAI
from agents import Agent, Tool, Runner

# Initialize OpenAI client
client = OpenAI()

# Define the assistant agent
assistant_agent = Agent(
    name="Bambu Assistant",
    model="gpt-4o",
    instructions="""You are a helpful 3D printing assistant that helps users create and print 3D objects.

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
""",
    tools=[
        generate_model_tool,
        check_model_status_tool,
        get_printer_status_tool,
        start_print_tool,
        cancel_print_tool
    ]
)
```

### Tool Definitions

```python
from agents import Tool, ToolResult
from pydantic import BaseModel, Field
from typing import Literal, Optional

# --- Generate 3D Model Tool ---

class GenerateModelInput(BaseModel):
    prompt: str = Field(
        description="Detailed description of the 3D model to generate"
    )
    style: Literal["cartoon", "realistic", "sculpture"] = Field(
        default="cartoon",
        description="Visual style of the model"
    )
    size_mm: float = Field(
        default=150.0,
        description="Target size in millimeters for the largest dimension"
    )

class GenerateModelOutput(BaseModel):
    job_id: str
    status: str
    message: str
    estimated_time_seconds: int

@Tool(
    name="generate_3d_model",
    description="""Generate a 3D model from a text description.
    
Use this when the user wants to create a new 3D object.
The model will be generated using AI and can be previewed before printing.

Always ask the user about:
- Desired style (cartoon works best for toys)
- Approximate size
- Any specific details or features

Returns a job_id to track the generation progress.""",
    input_schema=GenerateModelInput,
    output_schema=GenerateModelOutput
)
async def generate_model_tool(input: GenerateModelInput) -> GenerateModelOutput:
    # Create print job in database
    job = await create_print_job(
        prompt=input.prompt,
        style=input.style,
        target_size_mm=input.size_mm
    )
    
    # Start async generation (runs in background)
    asyncio.create_task(run_generation_pipeline(job.id))
    
    return GenerateModelOutput(
        job_id=str(job.id),
        status="generating",
        message=f"Started generating your {input.style} model. This usually takes 2-3 minutes.",
        estimated_time_seconds=180
    )


# --- Check Model Status Tool ---

class CheckStatusInput(BaseModel):
    job_id: str = Field(description="The job ID from generate_3d_model")

class CheckStatusOutput(BaseModel):
    status: Literal["generating", "ready", "failed"]
    progress_percent: int
    preview_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    dimensions_mm: Optional[dict] = None
    warnings: list[str] = []
    error: Optional[str] = None

@Tool(
    name="check_model_status",
    description="""Check the status of a 3D model generation job.
    
Use this to see if a model is ready for preview/printing.
When status is "ready", you can show the preview_url to the user.""",
    input_schema=CheckStatusInput,
    output_schema=CheckStatusOutput
)
async def check_model_status_tool(input: CheckStatusInput) -> CheckStatusOutput:
    job = await get_print_job(input.job_id)
    
    if job.status == "failed":
        return CheckStatusOutput(
            status="failed",
            progress_percent=0,
            error=job.error_message
        )
    
    if job.status == "ready":
        return CheckStatusOutput(
            status="ready",
            progress_percent=100,
            preview_url=job.model_url,
            thumbnail_url=job.thumbnail_url,
            dimensions_mm={
                "width": job.width_mm,
                "depth": job.depth_mm,
                "height": job.height_mm
            },
            warnings=job.warnings or []
        )
    
    return CheckStatusOutput(
        status="generating",
        progress_percent=job.progress or 0
    )


# --- Get Printer Status Tool ---

class PrinterStatusOutput(BaseModel):
    state: Literal["idle", "printing", "paused", "error", "offline"]
    current_job: Optional[str] = None
    progress_percent: Optional[int] = None
    remaining_time_minutes: Optional[int] = None
    temperatures: dict
    is_ready_to_print: bool

@Tool(
    name="get_printer_status",
    description="""Get the current status of the Bambu P1S printer.
    
Use this to check if the printer is available before starting a print,
or to get progress updates on a running print.""",
    input_schema=None,  # No input required
    output_schema=PrinterStatusOutput
)
async def get_printer_status_tool() -> PrinterStatusOutput:
    try:
        status = await get_bambu_status()
        
        return PrinterStatusOutput(
            state=status.state.value.lower(),
            current_job=status.job_name or None,
            progress_percent=status.progress_percent if status.state == PrinterState.RUNNING else None,
            remaining_time_minutes=status.remaining_time_seconds // 60 if status.remaining_time_seconds else None,
            temperatures={
                "nozzle": status.nozzle_temp,
                "bed": status.bed_temp,
                "chamber": status.chamber_temp
            },
            is_ready_to_print=status.state == PrinterState.IDLE
        )
    except Exception as e:
        return PrinterStatusOutput(
            state="offline",
            temperatures={},
            is_ready_to_print=False
        )


# --- Start Print Tool ---

class StartPrintInput(BaseModel):
    job_id: str = Field(description="The job ID of the model to print")
    
class StartPrintOutput(BaseModel):
    success: bool
    message: str
    estimated_time_minutes: Optional[int] = None

@Tool(
    name="start_print",
    description="""Start printing a 3D model on the Bambu P1S.
    
IMPORTANT: Always confirm with the user before calling this tool!
Show them the preview and estimated print time first.

The model must be in "ready" status (check with check_model_status first).""",
    input_schema=StartPrintInput,
    output_schema=StartPrintOutput
)
async def start_print_tool(input: StartPrintInput) -> StartPrintOutput:
    job = await get_print_job(input.job_id)
    
    if job.status != "ready":
        return StartPrintOutput(
            success=False,
            message=f"Cannot print: model status is '{job.status}', needs to be 'ready'"
        )
    
    # Check printer is idle
    printer_status = await get_bambu_status()
    if printer_status.state != PrinterState.IDLE:
        return StartPrintOutput(
            success=False,
            message=f"Printer is not ready: currently {printer_status.state.value}"
        )
    
    # Start the print
    try:
        await send_to_printer(job)
        
        # Update job status
        job.status = "printing"
        await save_print_job(job)
        
        return StartPrintOutput(
            success=True,
            message="Print started! I'll monitor progress and let you know when it's done.",
            estimated_time_minutes=job.estimated_print_time_minutes
        )
    except Exception as e:
        return StartPrintOutput(
            success=False,
            message=f"Failed to start print: {str(e)}"
        )


# --- Cancel Print Tool ---

class CancelPrintInput(BaseModel):
    job_id: Optional[str] = Field(
        default=None,
        description="Optional job ID. If not provided, cancels current print."
    )

class CancelPrintOutput(BaseModel):
    success: bool
    message: str

@Tool(
    name="cancel_print",
    description="""Cancel a print job.
    
Use this if the user wants to stop a print in progress.
The printer will stop and the print bed will cool down.""",
    input_schema=CancelPrintInput,
    output_schema=CancelPrintOutput
)
async def cancel_print_tool(input: CancelPrintInput) -> CancelPrintOutput:
    try:
        await cancel_bambu_print()
        
        if input.job_id:
            job = await get_print_job(input.job_id)
            job.status = "cancelled"
            await save_print_job(job)
        
        return CancelPrintOutput(
            success=True,
            message="Print cancelled. The printer will stop and cool down."
        )
    except Exception as e:
        return CancelPrintOutput(
            success=False,
            message=f"Failed to cancel: {str(e)}"
        )
```

### Conversation Flow Example

```
User: I want to make a toy dinosaur for my daughter
Assistant: I'd love to help you create a dinosaur toy! A few questions:

1. **Type?** T-Rex, Triceratops, Brachiosaurus, or something else?
2. **Style?** Cartoon/cute (recommended for toys - prints better) or realistic?  
3. **Size?** Small (3-4 inches), Medium (5-6 inches), or Large (8+ inches)?

User: T-Rex, cartoon style, about 6 inches tall. Make it cute and friendly!
Assistant: Perfect! A cute, friendly cartoon T-Rex at 6 inches - adorable!

Generating your model now. This usually takes 2-3 minutes...

[Calls generate_3d_model tool with enhanced prompt]
[Polls status until complete]

Great news! Your T-Rex is ready!
[Shows interactive 3D preview]

**Model Details:**
- Height: 152mm (6 inches)
- Width: 89mm  
- Depth: 112mm
- Print time: ~2 hours 15 minutes
- Status: Ready to print (no issues detected)

Would you like me to start printing?

User: Yes!
Assistant: Starting print now!

[Calls start_print tool]

Print started successfully! Your T-Rex is now printing.

**Print Progress:**
- Status: Printing
- Progress: 0%
- Time remaining: ~2 hours 15 minutes
- Bed temp: 60C (heating)
- Nozzle temp: 220C (heating)

I will notify you when it is done. You can ask me for status updates anytime!
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     users       │     │   print_jobs    │     │  conversations  │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │────<│ user_id (FK)    │     │ id (PK)         │
│ email           │     │ id (PK)         │>────│ print_job_id    │
│ name            │     │ prompt          │     │ user_id (FK)    │
│ created_at      │     │ refined_prompt  │     │ messages (JSON) │
│ preferences     │     │ style           │     │ created_at      │
└─────────────────┘     │ target_size_mm  │     │ updated_at      │
                        │ status          │     └─────────────────┘
                        │ meshy_preview_id│
                        │ meshy_refine_id │     ┌─────────────────┐
                        │ model_url       │     │  model_cache    │
                        │ thumbnail_url   │     ├─────────────────┤
                        │ print_file_url  │     │ id (PK)         │
                        │ width_mm        │     │ meshy_task_id   │
                        │ depth_mm        │     │ glb_url         │
                        │ height_mm       │     │ thumbnail_url   │
                        │ triangle_count  │     │ created_at      │
                        │ is_watertight   │     │ expires_at      │
                        │ warnings (JSON) │     └─────────────────┘
                        │ printer_job_id  │
                        │ print_started_at│
                        │ print_ended_at  │
                        │ estimated_mins  │
                        │ actual_mins     │
                        │ error_message   │
                        │ created_at      │
                        │ updated_at      │
                        └─────────────────┘
```

### SQLAlchemy Models

```python
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import uuid
import enum
from datetime import datetime

Base = declarative_base()

class JobStatus(enum.Enum):
    PENDING = "pending"           # Initial state
    GENERATING_PREVIEW = "generating_preview"
    GENERATING_REFINE = "generating_refine"
    CONVERTING = "converting"     # GLB to 3MF
    READY = "ready"               # Ready to print
    UPLOADING = "uploading"       # Uploading to printer
    PRINTING = "printing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    preferences = Column(JSON, default=dict)  # {default_size, default_style, etc}
    
    print_jobs = relationship("PrintJob", back_populates="user")
    conversations = relationship("Conversation", back_populates="user")

class PrintJob(Base):
    __tablename__ = "print_jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Input
    prompt = Column(String(2000), nullable=False)
    refined_prompt = Column(String(2000))  # Enhanced for printability
    style = Column(String(50), default="cartoon")
    target_size_mm = Column(Float, default=150.0)
    
    # Status tracking
    status = Column(Enum(JobStatus), default=JobStatus.PENDING)
    progress = Column(Integer, default=0)  # 0-100
    
    # Meshy integration
    meshy_preview_task_id = Column(String(100))
    meshy_refine_task_id = Column(String(100))
    
    # Generated assets
    model_url = Column(String(500))      # GLB URL for preview
    thumbnail_url = Column(String(500))
    print_file_url = Column(String(500)) # 3MF URL for printing
    
    # Model metadata
    width_mm = Column(Float)
    depth_mm = Column(Float)
    height_mm = Column(Float)
    triangle_count = Column(Integer)
    is_watertight = Column(Boolean)
    warnings = Column(JSON, default=list)
    
    # Print tracking
    printer_job_id = Column(String(100))
    print_started_at = Column(DateTime)
    print_ended_at = Column(DateTime)
    estimated_print_minutes = Column(Integer)
    actual_print_minutes = Column(Integer)
    
    # Error handling
    error_message = Column(String(1000))
    retry_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="print_jobs")

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    print_job_id = Column(UUID(as_uuid=True), ForeignKey("print_jobs.id"))
    
    messages = Column(JSON, default=list)  # [{role, content, timestamp}, ...]
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="conversations")

class ModelCache(Base):
    __tablename__ = "model_cache"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meshy_task_id = Column(String(100), unique=True, nullable=False)
    glb_url = Column(String(500))
    thumbnail_url = Column(String(500))
    prompt_hash = Column(String(64))  # For potential reuse
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)  # Meshy URLs expire after 24h
```

---

## API Specification

### Base Configuration

```yaml
openapi: 3.0.0
info:
  title: Bambu Assistant API
  version: 1.0.0
  description: AI-powered 3D printing assistant

servers:
  - url: https://bambu-assistant-api.vercel.app
    description: Production
  - url: http://localhost:8000
    description: Local development

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
```

### Endpoints

#### POST /chat
Send a message and get AI response.

```python
# Request
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

# Response
class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    actions: list[dict]  # UI actions (show_preview, confirm_print, etc)

@app.post("/chat")
async def chat(request: ChatRequest, user: User = Depends(get_current_user)):
    # Get or create conversation
    if request.conversation_id:
        conversation = await get_conversation(request.conversation_id)
    else:
        conversation = await create_conversation(user.id)
    
    # Add user message
    conversation.messages.append({
        "role": "user",
        "content": request.message,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    # Run agent
    runner = Runner(agent=assistant_agent)
    result = await runner.run(
        messages=conversation.messages,
        context={"user_id": str(user.id)}
    )
    
    # Extract response and actions
    response_text = result.final_output
    actions = extract_ui_actions(result)
    
    # Save conversation
    conversation.messages.append({
        "role": "assistant", 
        "content": response_text,
        "timestamp": datetime.utcnow().isoformat()
    })
    await save_conversation(conversation)
    
    return ChatResponse(
        response=response_text,
        conversation_id=str(conversation.id),
        actions=actions
    )
```

#### GET /jobs
List print jobs for current user.

```python
class JobSummary(BaseModel):
    id: str
    prompt: str
    status: str
    thumbnail_url: Optional[str]
    created_at: datetime

class JobListResponse(BaseModel):
    jobs: list[JobSummary]
    total: int
    page: int
    page_size: int

@app.get("/jobs")
async def list_jobs(
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    user: User = Depends(get_current_user)
) -> JobListResponse:
    query = select(PrintJob).where(PrintJob.user_id == user.id)
    
    if status:
        query = query.where(PrintJob.status == JobStatus(status))
    
    query = query.order_by(PrintJob.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    jobs = await db.execute(query)
    total = await db.scalar(select(func.count(PrintJob.id)).where(PrintJob.user_id == user.id))
    
    return JobListResponse(
        jobs=[JobSummary(
            id=str(j.id),
            prompt=j.prompt,
            status=j.status.value,
            thumbnail_url=j.thumbnail_url,
            created_at=j.created_at
        ) for j in jobs],
        total=total,
        page=page,
        page_size=page_size
    )
```

#### GET /jobs/{job_id}
Get detailed job information.

```python
class JobDetail(BaseModel):
    id: str
    prompt: str
    refined_prompt: Optional[str]
    style: str
    status: str
    progress: int
    model_url: Optional[str]
    thumbnail_url: Optional[str]
    dimensions: Optional[dict]
    warnings: list[str]
    estimated_print_minutes: Optional[int]
    print_progress: Optional[int]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

@app.get("/jobs/{job_id}")
async def get_job(job_id: str, user: User = Depends(get_current_user)) -> JobDetail:
    job = await get_print_job(job_id)
    
    if job.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    dimensions = None
    if job.width_mm:
        dimensions = {
            "width_mm": job.width_mm,
            "depth_mm": job.depth_mm,
            "height_mm": job.height_mm
        }
    
    return JobDetail(
        id=str(job.id),
        prompt=job.prompt,
        refined_prompt=job.refined_prompt,
        style=job.style,
        status=job.status.value,
        progress=job.progress,
        model_url=job.model_url,
        thumbnail_url=job.thumbnail_url,
        dimensions=dimensions,
        warnings=job.warnings or [],
        estimated_print_minutes=job.estimated_print_minutes,
        print_progress=await get_print_progress(job) if job.status == JobStatus.PRINTING else None,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at
    )
```

#### POST /jobs/{job_id}/print
Start printing a job.

```python
class PrintRequest(BaseModel):
    bed_leveling: bool = True
    use_ams: bool = False

class PrintResponse(BaseModel):
    success: bool
    message: str
    estimated_minutes: Optional[int]

@app.post("/jobs/{job_id}/print")
async def start_print(
    job_id: str,
    request: PrintRequest,
    user: User = Depends(get_current_user)
) -> PrintResponse:
    job = await get_print_job(job_id)
    
    if job.user_id != user.id:
        raise HTTPException(status_code=403)
    
    if job.status != JobStatus.READY:
        raise HTTPException(status_code=400, detail=f"Job not ready: {job.status.value}")
    
    # Check printer
    printer_status = await get_bambu_status()
    if printer_status.state != PrinterState.IDLE:
        raise HTTPException(status_code=400, detail=f"Printer busy: {printer_status.state.value}")
    
    # Start print
    await send_to_printer(job, bed_leveling=request.bed_leveling, use_ams=request.use_ams)
    
    job.status = JobStatus.PRINTING
    job.print_started_at = datetime.utcnow()
    await save_print_job(job)
    
    return PrintResponse(
        success=True,
        message="Print started",
        estimated_minutes=job.estimated_print_minutes
    )
```

#### GET /printer/status
Get printer status.

```python
class PrinterStatusResponse(BaseModel):
    state: str
    is_online: bool
    current_job: Optional[str]
    progress_percent: Optional[int]
    remaining_minutes: Optional[int]
    temperatures: dict
    camera_url: Optional[str]

@app.get("/printer/status")
async def printer_status(user: User = Depends(get_current_user)) -> PrinterStatusResponse:
    try:
        status = await get_bambu_status()
        
        return PrinterStatusResponse(
            state=status.state.value.lower(),
            is_online=True,
            current_job=status.job_name,
            progress_percent=status.progress_percent if status.state == PrinterState.RUNNING else None,
            remaining_minutes=status.remaining_time_seconds // 60 if status.remaining_time_seconds else None,
            temperatures={
                "nozzle": round(status.nozzle_temp, 1),
                "nozzle_target": round(status.nozzle_target, 1),
                "bed": round(status.bed_temp, 1),
                "bed_target": round(status.bed_target, 1),
                "chamber": round(status.chamber_temp, 1)
            },
            camera_url=f"/printer/camera/stream" if status.state == PrinterState.RUNNING else None
        )
    except Exception:
        return PrinterStatusResponse(
            state="offline",
            is_online=False,
            current_job=None,
            progress_percent=None,
            remaining_minutes=None,
            temperatures={},
            camera_url=None
        )
```

#### POST /printer/cancel
Cancel current print.

```python
@app.post("/printer/cancel")
async def cancel_print(user: User = Depends(get_current_user)):
    await cancel_bambu_print()
    
    # Update any printing jobs for this user
    printing_jobs = await get_jobs_by_status(user.id, JobStatus.PRINTING)
    for job in printing_jobs:
        job.status = JobStatus.CANCELLED
        job.print_ended_at = datetime.utcnow()
        await save_print_job(job)
    
    return {"success": True, "message": "Print cancelled"}
```

---

## Frontend Architecture

### Component Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Chat interface (main page)
│   ├── history/
│   │   └── page.tsx            # Print history
│   ├── printer/
│   │   └── page.tsx            # Printer dashboard
│   └── api/                    # API routes (if needed)
├── components/
│   ├── chat/
│   │   ├── ChatInterface.tsx   # Main chat component
│   │   ├── MessageList.tsx     # Message display
│   │   ├── MessageInput.tsx    # Input with send button
│   │   └── ActionButtons.tsx   # Inline action buttons
│   ├── model/
│   │   ├── ModelViewer.tsx     # 3D preview (Three.js)
│   │   ├── ModelCard.tsx       # Thumbnail + info
│   │   └── ModelDetails.tsx    # Full model info panel
│   ├── printer/
│   │   ├── PrinterStatus.tsx   # Status indicator
│   │   ├── PrintProgress.tsx   # Progress bar + details
│   │   ├── TemperatureGauge.tsx
│   │   └── CameraFeed.tsx      # Live camera stream
│   └── ui/                     # shadcn/ui components
├── hooks/
│   ├── useChat.ts              # Chat state management
│   ├── usePrinter.ts           # Printer status polling
│   └── useJob.ts               # Job status management
├── lib/
│   ├── api.ts                  # API client
│   └── utils.ts                # Utilities
└── types/
    └── index.ts                # TypeScript types
```

### Key Components

#### ModelViewer.tsx (Three.js)

```typescript
"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stage, useGLTF } from "@react-three/drei";
import { Group } from "three";

interface ModelViewerProps {
  modelUrl: string;
  autoRotate?: boolean;
  height?: string;
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const ref = useRef<Group>(null);
  
  useFrame((state) => {
    if (ref.current) {
      // Gentle auto-rotation
      ref.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });
  
  return <primitive ref={ref} object={scene} />;
}

export function ModelViewer({ 
  modelUrl, 
  autoRotate = true,
  height = "400px" 
}: ModelViewerProps) {
  return (
    <div style={{ height, width: "100%" }} className="rounded-lg overflow-hidden bg-gray-100">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5}>
            <Model url={modelUrl} />
          </Stage>
        </Suspense>
        <OrbitControls 
          enablePan={false}
          minDistance={2}
          maxDistance={10}
          autoRotate={autoRotate}
          autoRotateSpeed={1}
        />
      </Canvas>
    </div>
  );
}
```

#### ChatInterface.tsx

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ModelViewer } from "../model/ModelViewer";
import { PrintConfirmDialog } from "./PrintConfirmDialog";

export function ChatInterface() {
  const { 
    messages, 
    isLoading, 
    sendMessage, 
    currentJob,
    pendingAction 
  } = useChat();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b p-4">
        <h1 className="text-xl font-semibold">Bambu Assistant</h1>
        <p className="text-sm text-gray-500">AI-powered 3D printing</p>
      </header>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <MessageList messages={messages} />
        
        {/* Inline model preview */}
        {currentJob?.model_url && (
          <div className="my-4">
            <ModelViewer modelUrl={currentJob.model_url} />
            <div className="mt-2 text-sm text-gray-600">
              <p>Size: {currentJob.dimensions?.height_mm}mm tall</p>
              <p>Est. print time: {currentJob.estimated_print_minutes} minutes</p>
            </div>
          </div>
        )}
        
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
            <span>Thinking...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="border-t p-4">
        <MessageInput 
          onSend={sendMessage}
          disabled={isLoading}
          placeholder="Describe what you want to create..."
        />
      </div>
      
      {/* Print confirmation dialog */}
      {pendingAction?.type === "confirm_print" && (
        <PrintConfirmDialog
          job={pendingAction.job}
          onConfirm={() => pendingAction.onConfirm()}
          onCancel={() => pendingAction.onCancel()}
        />
      )}
    </div>
  );
}
```

---

## Error Handling

### Error Categories

```python
from enum import Enum
from typing import Optional
from dataclasses import dataclass

class ErrorCategory(Enum):
    GENERATION_FAILED = "generation_failed"
    CONVERSION_FAILED = "conversion_failed"
    PRINTER_OFFLINE = "printer_offline"
    PRINTER_BUSY = "printer_busy"
    PRINT_FAILED = "print_failed"
    NETWORK_ERROR = "network_error"
    VALIDATION_ERROR = "validation_error"
    RATE_LIMITED = "rate_limited"

@dataclass
class AppError:
    category: ErrorCategory
    message: str
    user_message: str  # Friendly message for UI
    retryable: bool
    details: Optional[dict] = None

# Error handlers
ERROR_HANDLERS = {
    ErrorCategory.GENERATION_FAILED: {
        "user_message": "Sorry, I could not generate that model. Try simplifying your description or using different words.",
        "retryable": True
    },
    ErrorCategory.CONVERSION_FAILED: {
        "user_message": "The model could not be prepared for printing. It may have complex geometry.",
        "retryable": True
    },
    ErrorCategory.PRINTER_OFFLINE: {
        "user_message": "I cannot reach the printer. Please check it is turned on and connected to WiFi.",
        "retryable": True
    },
    ErrorCategory.PRINTER_BUSY: {
        "user_message": "The printer is currently busy. Please wait for the current job to finish.",
        "retryable": False
    },
    ErrorCategory.PRINT_FAILED: {
        "user_message": "The print failed. Check the printer for issues (filament, bed adhesion, etc).",
        "retryable": True
    }
}
```

### Retry Logic

```python
import asyncio
from functools import wraps

def with_retry(
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (Exception,)
):
    """Decorator for automatic retry with exponential backoff."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay
            
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(current_delay)
                        current_delay *= backoff
            
            raise last_exception
        return wrapper
    return decorator

# Usage
@with_retry(max_attempts=3, delay=2.0, exceptions=(ConnectionError, TimeoutError))
async def connect_to_printer():
    ...
```

---

## Development Phases

### Phase 1: Core Chat + 3D Generation (Week 1-2)
- [ ] Project scaffolding (Next.js + FastAPI)
- [ ] Meshy API integration with full error handling
- [ ] Basic chat UI with message history
- [ ] Three.js model viewer component
- [ ] OpenAI agent with generate tool
- [ ] Database schema and migrations
- [ ] Job status polling

### Phase 2: Printer Integration (Week 3-4)
- [ ] MQTT client implementation
- [ ] FTPS upload client
- [ ] GLB to 3MF conversion with trimesh
- [ ] Print command sending
- [ ] Status monitoring and progress tracking
- [ ] Camera feed integration

### Phase 3: Polish and Testing (Week 5)
- [ ] Print history page
- [ ] Printer dashboard with live status
- [ ] Error recovery and retry logic
- [ ] Print time estimation
- [ ] User preferences
- [ ] End-to-end testing

### Phase 4: Enhancements (Future)
- [ ] Voice input
- [ ] Multiple printer support
- [ ] Model library (favorites)
- [ ] Cost tracking
- [ ] Print quality feedback loop

---

## Environment and Deployment

### Environment Variables

```bash
# .env.local (frontend)
NEXT_PUBLIC_API_URL=http://localhost:8000

# .env (backend)
# OpenAI
OPENAI_API_KEY=sk-...

# Meshy
MESHY_API_KEY=msy_...

# Bambu P1S
BAMBU_PRINTER_IP=192.168.1.100
BAMBU_SERIAL_NUMBER=01S00A123456789
BAMBU_ACCESS_CODE=12345678

# Database
DATABASE_URL=postgresql://...

# Storage (optional - for caching models)
BLOB_READ_WRITE_TOKEN=vercel_blob_...
```

### Vercel Configuration

```json
// frontend/vercel.json
{
  "framework": "nextjs"
}

// backend/vercel.json
{
  "builds": [
    {
      "src": "app/main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app/main.py"
    }
  ]
}
```

### Local Development

```bash
# Terminal 1: Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
pnpm install
pnpm dev
```

---

## Appendix: Print Time Estimation

Since accurate print time requires slicing, we use rough estimation:

```python
def estimate_print_time_minutes(
    volume_mm3: float,
    height_mm: float,
    infill_percent: float = 15,
    layer_height_mm: float = 0.2
) -> int:
    """
    Rough print time estimation.
    
    Based on typical P1S speeds:
    - Outer wall: 80mm/s
    - Inner wall: 120mm/s  
    - Infill: 200mm/s
    - Travel: 300mm/s
    
    This is approximate - actual time depends on model complexity.
    """
    # Estimate layer count
    layers = height_mm / layer_height_mm
    
    # Rough volume per layer
    volume_per_layer = volume_mm3 / layers
    
    # Assume average extrusion rate
    avg_speed_mm_per_sec = 100
    extrusion_width = 0.4  # mm
    
    # Time per layer (very rough)
    perimeter_per_layer = (volume_per_layer ** 0.5) * 4  # rough perimeter
    time_per_layer_sec = perimeter_per_layer / avg_speed_mm_per_sec
    
    # Add infill time
    infill_factor = 1 + (infill_percent / 100)
    time_per_layer_sec *= infill_factor
    
    # Total time with overhead (heating, travel, etc)
    total_seconds = layers * time_per_layer_sec * 1.3
    
    # Add fixed overhead (bed leveling, heating)
    total_seconds += 300  # 5 minutes
    
    return int(total_seconds / 60)
```

---

## References

- Meshy API Docs: https://docs.meshy.ai
- Bambu Lab Wiki: https://wiki.bambulab.com
- ha-bambulab (Home Assistant): https://github.com/greghesp/ha-bambulab
- Three.js Documentation: https://threejs.org/docs
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber
- OpenAI Agents SDK: https://github.com/openai/openai-agents-python
- trimesh Library: https://trimesh.org
