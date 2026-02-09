"""
Chat API endpoint.
"""
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.assistant import get_assistant

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    """Chat request body."""
    message: str
    conversation_id: Optional[str] = None


class ChatAction(BaseModel):
    """UI action from assistant."""
    type: str  # generating, show_preview, print_started, etc
    job_id: Optional[str] = None
    model_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    success: Optional[bool] = None


class ChatResponse(BaseModel):
    """Chat response body."""
    response: str
    conversation_id: str
    actions: list[ChatAction]


# In-memory conversation storage (replace with DB)
conversations: dict[str, list[dict]] = {}


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Send a message to the assistant and get a response.
    
    The assistant can use tools to:
    - Generate 3D models
    - Check generation status
    - Get printer status
    - Start/cancel prints
    """
    # Get or create conversation
    if request.conversation_id:
        if request.conversation_id not in conversations:
            raise HTTPException(404, "Conversation not found")
        history = conversations[request.conversation_id]
    else:
        import uuid
        conversation_id = str(uuid.uuid4())
        history = []
        conversations[conversation_id] = history
        request.conversation_id = conversation_id
    
    # Add user message to history
    history.append({
        "role": "user",
        "content": request.message,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    # Get assistant response
    assistant = get_assistant()
    response_text, actions = await assistant.chat(request.message, history[:-1])
    
    # Add assistant message to history
    history.append({
        "role": "assistant",
        "content": response_text,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return ChatResponse(
        response=response_text,
        conversation_id=request.conversation_id,
        actions=[ChatAction(**a) for a in actions]
    )


@router.get("/{conversation_id}/history")
async def get_history(conversation_id: str) -> list[dict]:
    """Get conversation history."""
    if conversation_id not in conversations:
        raise HTTPException(404, "Conversation not found")
    return conversations[conversation_id]
