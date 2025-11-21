"""
REST API __init__ - Combines all REST endpoints
"""

from fastapi import APIRouter
from src.model.shared import MODEL_TYPE_MAP
import json

# Create main REST API router
router = APIRouter(
    prefix="/models",
    tags=["models-rest"],
)

@router.get("/available", summary="Get available model types to train", response_model=dict)
async def get_available_models():
    """
    Returns available model types for training (e.g., AnomalyPredictor, ForecastModel).
    """
    models = {}
    for k, v in MODEL_TYPE_MAP.items():
        models[k] = [json.loads(json.dumps(item, default=str)) for item in v]

    return models