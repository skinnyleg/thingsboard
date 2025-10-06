"""
WebSocket endpoint: /ws/job
Job monitoring endpoint for background prediction jobs
Uses ThingsBoard command pattern with commandId
"""

import json
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from src.settings import settings
from ..job import active_jobs, job_lock, model_logs

router = APIRouter()


@router.websocket("/ws/job")
async def job_monitoring_stream(websocket: WebSocket):
    """
    WebSocket endpoint for monitoring background prediction jobs.

    Uses ThingsBoard command pattern with commandId to differentiate requests.
    Listens to job predictions and provides real-time results.

    Client message format (ThingsBoard-style):
    {
        "commandId": 123,
        "type": "job_status" | "job_logs" | "job_listen",
        "forecastId": "forecast_001",
        "data": {...}  // Optional, depends on type
    }

    For job status:
    {
        "commandId": 125,
        "type": "job_status",
        "forecastId": "forecast_001"
    }

    For job logs:
    {
        "commandId": 126,
        "type": "job_logs",
        "forecastId": "forecast_001",
        "data": {
            "limit": 50  // Optional, default 100
        }
    }

    For job listen (real-time predictions):
    {
        "commandId": 127,
        "type": "job_listen",
        "forecastId": "forecast_001",
        "modelType": "anomaly" | "forecast"
    }

    Server response format:
    {
        "commandId": 123,  // Same as request
        "type": "response" | "error" | "prediction",
        "model": "anomaly" | "forecast" | "job",
        "data": {...},
        "timestamp": "ISO8601"
    }
    """
    await websocket.accept()

    # Track active listeners for this connection
    active_listeners = {}  # {forecast_id: {model_type: last_iteration}}

    try:
        # Send connection confirmation
        await websocket.send_json(
            {
                "type": "connection",
                "message": "Connected to job monitoring stream",
                "protocol": "thingsboard-command",
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )

        # Listen for commands
        while True:
            message = await websocket.receive_json()

            command_id = message.get("commandId")
            msg_type = message.get("type")
            forecast_id = message.get("forecastId")
            data = message.get("data", {})

            # Validate required fields
            if not command_id:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "Missing required field: commandId",
                        "timestamp": datetime.now().isoformat() + "Z",
                    }
                )
                continue

            if msg_type not in ["job_status", "job_logs", "job_listen", "ping"]:
                await websocket.send_json(
                    {
                        "commandId": command_id,
                        "type": "error",
                        "message": f"Invalid type: {msg_type}. Expected: job_status, job_logs, job_listen, or ping",
                        "timestamp": datetime.now().isoformat() + "Z",
                    }
                )
                continue

            # Handle ping
            if msg_type == "ping":
                await websocket.send_json(
                    {
                        "commandId": command_id,
                        "type": "pong",
                        "timestamp": datetime.now().isoformat() + "Z",
                    }
                )
                continue

            # Validate forecastId for other types
            if not forecast_id:
                await websocket.send_json(
                    {
                        "commandId": command_id,
                        "type": "error",
                        "message": "Missing required field: forecastId",
                        "timestamp": datetime.now().isoformat() + "Z",
                    }
                )
                continue

            # Handle job status request
            if msg_type == "job_status":
                with job_lock:
                    job_info = active_jobs.get(forecast_id)

                if job_info:
                    await websocket.send_json(
                        {
                            "commandId": command_id,
                            "type": "response",
                            "model": "job",
                            "forecastId": forecast_id,
                            "data": {
                                "status": job_info.get("status"),
                                "model_type": job_info.get("model_type"),
                                "device_id": job_info.get("device_id"),
                                "start_time": job_info.get("start_time"),
                                "last_run": job_info.get("last_run"),
                                "iterations": job_info.get("iterations", 0),
                            },
                            "timestamp": datetime.now().isoformat() + "Z",
                        }
                    )
                else:
                    await websocket.send_json(
                        {
                            "commandId": command_id,
                            "type": "response",
                            "model": "job",
                            "forecastId": forecast_id,
                            "data": {"status": "not_found"},
                            "timestamp": datetime.now().isoformat() + "Z",
                        }
                    )
                continue

            # Handle job logs request
            if msg_type == "job_logs":
                limit = data.get("limit", 100)
                logs = list(model_logs.get(forecast_id, []))[-limit:]

                await websocket.send_json(
                    {
                        "commandId": command_id,
                        "type": "response",
                        "model": "job",
                        "forecastId": forecast_id,
                        "data": {"logs": logs, "count": len(logs)},
                        "timestamp": datetime.now().isoformat() + "Z",
                    }
                )
                continue

            # Handle job listen request
            if msg_type == "job_listen":
                model_type = message.get("modelType")

                # Validate modelType
                if not model_type:
                    await websocket.send_json(
                        {
                            "commandId": command_id,
                            "type": "error",
                            "message": "Missing required field: modelType (expected 'anomaly' or 'forecast')",
                            "timestamp": datetime.now().isoformat() + "Z",
                        }
                    )
                    continue

                if model_type not in ["anomaly", "forecast"]:
                    await websocket.send_json(
                        {
                            "commandId": command_id,
                            "type": "error",
                            "message": f"Invalid modelType: {model_type}. Expected 'anomaly' or 'forecast'",
                            "timestamp": datetime.now().isoformat() + "Z",
                        }
                    )
                    continue

                # Check if job exists and is running
                with job_lock:
                    job_info = active_jobs.get(forecast_id)

                if not job_info:
                    await websocket.send_json(
                        {
                            "commandId": command_id,
                            "type": "error",
                            "message": f"No active job found for forecastId: {forecast_id}",
                            "code": 404,
                            "timestamp": datetime.now().isoformat() + "Z",
                        }
                    )
                    continue

                if job_info.get("status") != "running":
                    await websocket.send_json(
                        {
                            "commandId": command_id,
                            "type": "error",
                            "message": f"Job is not running for forecastId: {forecast_id}. Status: {job_info.get('status')}",
                            "timestamp": datetime.now().isoformat() + "Z",
                        }
                    )
                    continue

                # Register listener
                if forecast_id not in active_listeners:
                    active_listeners[forecast_id] = {}

                active_listeners[forecast_id][model_type] = {
                    "command_id": command_id,
                    "last_iteration": job_info.get("iterations", 0),
                }

                # Send confirmation
                await websocket.send_json(
                    {
                        "commandId": command_id,
                        "type": "response",
                        "model": model_type,
                        "forecastId": forecast_id,
                        "data": {
                            "status": "listening",
                            "message": f"Now listening to {model_type} predictions for {forecast_id}",
                            "current_iteration": job_info.get("iterations", 0),
                        },
                        "timestamp": datetime.now().isoformat() + "Z",
                    }
                )
                continue

    except WebSocketDisconnect:
        print(f"Client disconnected from job monitoring stream")
    except Exception as e:
        print(f"Error in job monitoring stream: {str(e)}")
        try:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": str(e),
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )
            await websocket.close(code=1011, reason=str(e))
        except:
            pass
    finally:
        # Cleanup active listeners for this connection
        active_listeners.clear()
