from pydantic import BaseSettings
from typing import List

class Settings(BaseSettings):
    app_name: str = "predictive-maintenance"
    app_description: str = "Predictive Maintenance Service"
    app_version: str = "0.1.0"
    app_debug: bool = True
    app_root_path: str = "/api/v1"
    cors_origins: List[str] = ["http://thingsboard:8080", "http://thingsboard:4200"]
    models_path: str = "/app/models"

settings = Settings()