"""
Main model service module - Combines REST API, WebSocket, and Integration endpoints

This module provides:
1. REST API endpoints (GET /status, PATCH /activate)
2. WebSocket endpoints (anomaly prediction, forecast, anomaly streaming)
3. Background job management system
4. Socket server integration for ThingsBoard Java backend

Directory Structure:
- api/          - REST API endpoints
  - status.py   - GET /{forecast_id}/status
  - activate.py - PATCH /{forecast_id}/activate
- ws/           - WebSocket endpoints
  - predict_anomaly.py   - /ws/{forecast_id}/predict/anomaly
  - predict_forecast.py  - /ws/{forecast_id}/predict/forecast
  - anomalies.py         - /ws/{forecast_id}/anomalies
- shared.py     - Shared utilities (get_data_registry, train_and_save_model)
- job.py        - Background job management
- integration.py - Socket server for Java backend integration

Usage:
    from src.model.model import router
    app.include_router(router)
"""

from fastapi import APIRouter
from src.model.api import router as api_router
from src.model.ws import router as ws_router

# Create main router that combines all sub-routers
router = APIRouter()

# Include REST API routes
router.include_router(api_router)

# Include WebSocket routes
router.include_router(ws_router)

# Socket server integration is auto-started in integration.py
# To disable: Set environment variable ENABLE_SOCKET_SERVER=false

__all__ = ["router"]
