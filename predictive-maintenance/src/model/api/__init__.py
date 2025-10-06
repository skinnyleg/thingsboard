"""
REST API __init__ - Combines all REST endpoints
"""

from fastapi import APIRouter

# Create main REST API router
router = APIRouter(
    prefix="/models",
    tags=["models-rest"],
)

# Include sub-routers
