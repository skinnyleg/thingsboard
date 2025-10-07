"""
WebSocket __init__ - Combines all WebSocket endpoints
"""

from fastapi import APIRouter
from .unified import router as unified_router  # Unified endpoint (recommended)

# Create main WebSocket router
router = APIRouter(
    prefix="/models",
    tags=["models-websocket"],
)

# Include unified router (recommended approach)
router.include_router(unified_router)

# Include legacy routers for backward compatibility
