import os
from fastapi import APIRouter
from src.settings import settings

router = APIRouter(
    prefix="/models",
    tags=["models"],
)

@router.get("/{forecast_id}/status")
def get_model_status(forecast_id: str):
    """Endpoint to get the status of a specific model by forecast_id"""
    # Placeholder implementation
    path = settings.models_path
    # read directory and check if model.h5 file exists for the given forecast_id

    model_path = f"{path}/{forecast_id}/model.h5"
    if os.path.exists(model_path):
        return {
            "forecast_id": forecast_id,
            "status": "active"
        }
    else:
        return {
            "forecast_id": forecast_id,
            "status": "inactive"
        }