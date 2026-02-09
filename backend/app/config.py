"""
Application configuration.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings from environment."""
    
    # OpenAI
    openai_api_key: str = ""
    
    # Meshy
    meshy_api_key: str = ""
    
    # Bridge (local printer service)
    bridge_url: str = "http://localhost:8765"
    
    # Database
    database_url: str = ""
    
    # App settings
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:3000", "https://*.vercel.app"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
