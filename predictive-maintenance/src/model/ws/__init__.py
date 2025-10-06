"""
WebSocket __init__ - Combines all WebSocket endpoints
"""

from fastapi import APIRouter
from .predict import router as predict_router  # Job monitoring endpoint
from .activate import router as activate_router  # Model activation endpoint
from .unified import router as unified_router  # Unified endpoint (recommended)

# Create main WebSocket router
router = APIRouter(
    prefix="/models",
    tags=["models-websocket"],
)

# Include unified router (recommended approach)
router.include_router(unified_router)

# Include legacy routers for backward compatibility
router.include_router(predict_router)  # Legacy job monitoring
router.include_router(activate_router)  # Legacy activation
