import os
from fastapi import APIRouter, HTTPException
from src.settings import settings

router = APIRouter(
    prefix="/models",
    tags=["models"],
)


@router.get("/{forecast_id}/status")
def get_model_status(forecast_id: str):
    """Endpoint to get the status of a specific model by forecast_id"""
    path = settings.models_path
    # Check if model.h5 file exists for the given forecast_id
    model_path = f"{path}/{forecast_id}/model.h5"

    if os.path.exists(model_path):
        return {"forecast_id": forecast_id, "status": "active"}
    else:
        return {"forecast_id": forecast_id, "status": "inactive"}


@router.patch("/{forecast_id}/activate")
def activate_model(forecast_id: str):
    """Endpoint to activate a specific model by forecast_id"""
    try:
        path = settings.models_path
        forecast_dir = f"{path}/{forecast_id}"
        model_path = f"{forecast_dir}/model.h5"

        # Create directory if it doesn't exist (including parent directories)
        os.makedirs(forecast_dir, exist_ok=True)

        # Create .h5 file if it doesn't exist
        # Use try-except here to handle the case where even checking existence might fail
        try:
            exists = os.path.exists(model_path)
        except (FileNotFoundError, OSError):
            exists = False

        if not exists:
            with open(model_path, "w") as f:
                f.write("")

        return {"forecast_id": forecast_id, "status": "active"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to activate model: {str(e)}"
        )
