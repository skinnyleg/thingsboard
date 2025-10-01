from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, ValidationInfo
from typing import List, Union


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "predictive-maintenance"
    app_description: str = "Predictive Maintenance Service"
    app_version: str = "0.1.0"
    app_debug: bool = True
    app_root_path: str = "/api/v1"
    cors_origins: Union[List[str], str] = [
        "http://thingsboard:8080",
        "http://thingsboard:4200",
    ]
    models_path: str = "/app/models"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[List[str], str]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()
