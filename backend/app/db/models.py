"""
SQLAlchemy database models.
"""
import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class JobStatus(enum.Enum):
    """Print job status enum."""
    PENDING = "pending"
    GENERATING_PREVIEW = "generating_preview"
    GENERATING_REFINE = "generating_refine"
    CONVERTING = "converting"
    READY = "ready"
    UPLOADING = "uploading"
    PRINTING = "printing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class User(Base):
    """User model for tracking print jobs."""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    preferences = Column(JSON, default=dict)
    
    # Relationships
    print_jobs = relationship("PrintJob", back_populates="user")
    conversations = relationship("Conversation", back_populates="user")


class PrintJob(Base):
    """Print job model tracking model generation and printing."""
    __tablename__ = "print_jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Input
    prompt = Column(Text, nullable=False)
    refined_prompt = Column(Text)
    style = Column(String(50), default="cartoon")
    target_size_mm = Column(Float, default=150.0)
    
    # Status tracking
    status = Column(Enum(JobStatus), default=JobStatus.PENDING)
    progress = Column(Integer, default=0)
    
    # Meshy integration
    meshy_preview_task_id = Column(String(100))
    meshy_refine_task_id = Column(String(100))
    
    # Generated assets
    model_url = Column(String(500))
    thumbnail_url = Column(String(500))
    print_file_url = Column(String(500))
    
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
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="print_jobs")


class Conversation(Base):
    """Conversation model for chat history."""
    __tablename__ = "conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    print_job_id = Column(UUID(as_uuid=True), ForeignKey("print_jobs.id"))
    
    messages = Column(JSON, default=list)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="conversations")


class ModelCache(Base):
    """Cache for Meshy generated models."""
    __tablename__ = "model_cache"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meshy_task_id = Column(String(100), unique=True, nullable=False)
    glb_url = Column(String(500))
    thumbnail_url = Column(String(500))
    prompt_hash = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
