"""
Bambu Bridge Service

Local service that connects to Bambu P1S printer and exposes REST API.
Accessible via Tailscale from the cloud backend.

Run: uvicorn main:app --host 0.0.0.0 --port 8765
"""

import os
import ssl
import json
import asyncio
import ftplib
from pathlib import Path
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import paho.mqtt.client as mqtt

# Configuration
PRINTER_IP = os.environ.get("BAMBU_PRINTER_IP", "192.168.1.100")
PRINTER_SERIAL = os.environ.get("BAMBU_SERIAL_NUMBER", "")
PRINTER_ACCESS_CODE = os.environ.get("BAMBU_ACCESS_CODE", "")
BRIDGE_PORT = int(os.environ.get("BRIDGE_PORT", "8765"))

# State
printer_status = {
    "connected": False,
    "state": "unknown",
    "progress": 0,
    "remaining_minutes": 0,
    "job_name": None,
    "nozzle_temp": 0,
    "bed_temp": 0,
    "chamber_temp": 0,
    "last_update": None
}

mqtt_client: Optional[mqtt.Client] = None


# --- MQTT Client ---

def create_tls_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def on_connect(client, userdata, flags, rc):
    global printer_status
    if rc == 0:
        print(f"Connected to printer {PRINTER_SERIAL}")
        client.subscribe(f"device/{PRINTER_SERIAL}/report")
        printer_status["connected"] = True
        # Request full status
        client.publish(
            f"device/{PRINTER_SERIAL}/request",
            json.dumps({"pushing": {"sequence_id": "0", "command": "pushall"}})
        )
    else:
        print(f"Connection failed with code {rc}")
        printer_status["connected"] = False


def on_disconnect(client, userdata, rc):
    global printer_status
    print(f"Disconnected from printer (rc={rc})")
    printer_status["connected"] = False


def on_message(client, userdata, msg):
    global printer_status
    try:
        payload = json.loads(msg.payload.decode())
        print_data = payload.get("print", {})
        
        if print_data:
            printer_status.update({
                "state": print_data.get("gcode_state", "unknown").lower(),
                "progress": print_data.get("mc_percent", 0),
                "remaining_minutes": print_data.get("mc_remaining_time", 0) // 60,
                "job_name": print_data.get("subtask_name"),
                "nozzle_temp": print_data.get("nozzle_temper", 0),
                "bed_temp": print_data.get("bed_temper", 0),
                "chamber_temp": print_data.get("chamber_temper", 0),
                "last_update": datetime.utcnow().isoformat()
            })
    except Exception as e:
        print(f"Error parsing message: {e}")


def setup_mqtt():
    global mqtt_client
    
    if not PRINTER_SERIAL or not PRINTER_ACCESS_CODE:
        print("Warning: Printer credentials not configured")
        return
    
    mqtt_client = mqtt.Client(
        client_id=f"bambu_bridge_{PRINTER_SERIAL}",
        protocol=mqtt.MQTTv311
    )
    mqtt_client.username_pw_set("bblp", PRINTER_ACCESS_CODE)
    mqtt_client.tls_set_context(create_tls_context())
    
    mqtt_client.on_connect = on_connect
    mqtt_client.on_disconnect = on_disconnect
    mqtt_client.on_message = on_message
    
    try:
        mqtt_client.connect_async(PRINTER_IP, 8883, keepalive=5)
        mqtt_client.loop_start()
        print(f"Connecting to printer at {PRINTER_IP}...")
    except Exception as e:
        print(f"Failed to connect: {e}")


def send_command(command: dict):
    if mqtt_client and printer_status["connected"]:
        mqtt_client.publish(
            f"device/{PRINTER_SERIAL}/request",
            json.dumps(command)
        )
    else:
        raise RuntimeError("Printer not connected")


# --- FTPS Upload ---

class ImplicitFTPS(ftplib.FTP_TLS):
    """FTP_TLS with implicit TLS (port 990)."""
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


def upload_file_to_printer(local_path: Path, remote_name: str) -> bool:
    """Upload a file to the printer via FTPS."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        ftp = ImplicitFTPS(context=ctx)
        ftp.connect(PRINTER_IP, 990, timeout=30)
        ftp.login("bblp", PRINTER_ACCESS_CODE)
        ftp.prot_p()
        ftp.set_pasv(True)
        
        with open(local_path, "rb") as f:
            ftp.storbinary(f"STOR {remote_name}", f)
        
        ftp.quit()
        return True
    except Exception as e:
        print(f"FTP upload failed: {e}")
        return False


# --- FastAPI App ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_mqtt()
    yield
    # Shutdown
    if mqtt_client:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()


app = FastAPI(
    title="Bambu Bridge",
    description="Local bridge service for Bambu P1S printer",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Models ---

class PrintRequest(BaseModel):
    filename: str
    bed_leveling: bool = True
    use_ams: bool = False


# --- Endpoints ---

@app.get("/")
async def root():
    return {"service": "bambu-bridge", "status": "running"}


@app.get("/status")
async def get_status():
    """Get current printer status."""
    return printer_status


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a 3MF file to the printer."""
    if not file.filename.endswith(".3mf"):
        raise HTTPException(400, "Only .3mf files supported")
    
    # Save to temp file
    temp_path = Path(f"/tmp/{file.filename}")
    with open(temp_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Upload to printer
    success = upload_file_to_printer(temp_path, file.filename)
    
    # Clean up
    temp_path.unlink(missing_ok=True)
    
    if not success:
        raise HTTPException(500, "Failed to upload file to printer")
    
    return {"success": True, "filename": file.filename}


@app.post("/print")
async def start_print(request: PrintRequest):
    """Start printing an uploaded file."""
    if not printer_status["connected"]:
        raise HTTPException(503, "Printer not connected")
    
    if printer_status["state"] not in ["idle", "finish", "failed"]:
        raise HTTPException(400, f"Printer busy: {printer_status['state']}")
    
    command = {
        "print": {
            "sequence_id": "0",
            "command": "project_file",
            "param": "Metadata/plate_1.gcode",
            "subtask_name": request.filename.replace(".3mf", ""),
            "url": f"ftp://{request.filename}",
            "timelapse": False,
            "bed_leveling": request.bed_leveling,
            "flow_cali": False,
            "vibration_cali": False,
            "layer_inspect": False,
            "use_ams": request.use_ams
        }
    }
    
    try:
        send_command(command)
        return {"success": True, "message": "Print started"}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/pause")
async def pause_print():
    """Pause current print."""
    try:
        send_command({"print": {"sequence_id": "0", "command": "pause"}})
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/resume")
async def resume_print():
    """Resume paused print."""
    try:
        send_command({"print": {"sequence_id": "0", "command": "resume"}})
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/stop")
async def stop_print():
    """Stop/cancel current print."""
    try:
        send_command({"print": {"sequence_id": "0", "command": "stop"}})
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/light")
async def toggle_light(on: bool = True):
    """Toggle chamber light."""
    try:
        send_command({
            "system": {
                "sequence_id": "0",
                "command": "ledctrl",
                "led_node": "chamber_light",
                "led_mode": "on" if on else "off"
            }
        })
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=BRIDGE_PORT)
