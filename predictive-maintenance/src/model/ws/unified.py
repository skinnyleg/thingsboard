"""
Unified WebSocket endpoint: /ws/unified
Handles model activation (training), prediction listening, and log subscription
Uses ThingsBoard command pattern with commandId
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Set, Callable
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from src.model.shared import get_data_registry, train_and_save_model
from src.model.job import (
    start_prediction_job,
    stop_prediction_job,
    get_job_status,
    get_model_logs,
    subscribe_to_logs,
    unsubscribe_from_logs,
)
from src.settings import settings
from pathlib import Path
import traceback
import asyncio
import traceback

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/unified")
async def unified_model_stream(websocket: WebSocket):
    """
    Unified WebSocket endpoint for all model operations.

    Supports the following command types:

    1. activate - Train and activate models
    {
        "commandId": 123,
        "type": "activate",
        "forecastId": "uuid",
        "data": {
            "deviceId": "uuid"  // optional
        }
    }

    2. job_status - Get job status
    {
        "commandId": 124,
        "type": "job_status",
        "forecastId": "uuid"
    }

    3. job_logs - Get job logs
    {
        "commandId": 125,
        "type": "job_logs",
        "forecastId": "uuid",
        "data": {
            "limit": 100  // optional
        }
    }

    4. subscribe_predictions - Subscribe to real-time predictions
    {
        "commandId": 126,
        "type": "subscribe_predictions",
        "forecastId": "uuid",
        "data": {
            "modelType": "anomaly" | "forecast"
        }
    }

    5. unsubscribe_predictions - Unsubscribe from predictions
    {
        "commandId": 127,
        "type": "unsubscribe_predictions",
        "forecastId": "uuid",
        "data": {
            "modelType": "anomaly" | "forecast"
        }
    }

    6. subscribe_logs - Subscribe to real-time logs
    {
        "commandId": 128,
        "type": "subscribe_logs",
        "forecastId": "uuid"
    }

    7. unsubscribe_logs - Unsubscribe from logs
    {
        "commandId": 129,
        "type": "unsubscribe_logs",
        "forecastId": "uuid"
    }

    8. stop_job - Stop a running job
    {
        "commandId": 130,
        "type": "stop_job",
        "forecastId": "uuid"
    }

    9. ping - Health check
    {
        "commandId": 131,
        "type": "ping"
    }
    """
    await websocket.accept()

    # Track subscriptions for this connection
    prediction_subscriptions: Dict[str, Set[str]] = {}  # {forecastId: {modelTypes}}
    log_subscriptions: Set[str] = set()  # {forecastIds}
    log_callbacks: Dict[str, Callable] = {}  # {model_id: callback_function}
    last_iterations: Dict[str, int] = {}  # {model_id: last_iteration}

    logger.info("Unified WebSocket connection established")
    print(f"[WEBSOCKET] New client connected to unified endpoint")

    try:
        # Send connection confirmation
        await websocket.send_json(
            {
                "type": "connection",
                "message": "Connected to unified model service",
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )

        # Create task for subscription updates
        async def subscription_updater():
            """Background task to send prediction subscription updates (logs are now real-time)"""
            print(
                f"[SUBSCRIPTION UPDATER] Background task started for prediction updates"
            )
            while True:
                try:
                    # Send prediction updates
                    for forecast_id, model_types in prediction_subscriptions.items():
                        for model_type in model_types:
                            model_id = (
                                f"{forecast_id}/{model_type}_predictor"
                                if model_type == "anomaly"
                                else f"{forecast_id}/forecast_model"
                            )

                            # Check if job has new iterations
                            job_status = get_job_status(model_id)
                            if job_status and job_status.get("status") == "running":
                                current_iteration = job_status.get("iterations", 0)
                                last_iteration = last_iterations.get(model_id, 0)

                                if current_iteration > last_iteration:
                                    # Send prediction update (Java backend expects 'model' field)
                                    await websocket.send_json(
                                        {
                                            "type": "prediction",
                                            "forecastId": forecast_id,
                                            "model": model_type,  # Java backend uses 'model' not 'modelType'
                                            "data": {
                                                "iteration": current_iteration,
                                                "status": job_status.get("status"),
                                                "last_run": job_status.get("last_run"),
                                            },
                                            "timestamp": datetime.now().isoformat()
                                            + "Z",
                                        }
                                    )
                                    last_iterations[model_id] = current_iteration

                    # Wait before next check (logs are now sent in real-time via callbacks)
                    await asyncio.sleep(2)

                except Exception as e:
                    logger.error(f"Error in subscription updater: {str(e)}")
                    await asyncio.sleep(5)

        # Start subscription updater task
        # updater_task = asyncio.create_task(subscription_updater())

        # Main message handling loop
        while True:
            message = await websocket.receive_json()
            print(f"[WEBSOCKET] Received message: {message}")

            command_id = message.get("commandId")
            msg_type = message.get("type")
            forecast_id = message.get("forecastId")
            data = message.get("data", {})

            print(
                f"[WEBSOCKET] Parsed - type: {msg_type}, commandId: {command_id}, forecastId: {forecast_id}"
            )

            # Validate commandId (except for connection/ping messages from Java backend)
            if command_id is None and msg_type not in ["connection", "ping"]:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "Missing required field: commandId",
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

            # Validate forecastId for other types (except connection/ping)
            if not forecast_id and msg_type not in ["ping", "connection"]:
                await websocket.send_json(
                    {
                        "commandId": command_id,
                        "type": "error",
                        "message": "Missing required field: forecastId",
                        "timestamp": datetime.now().isoformat() + "Z",
                    }
                )
                continue

            # Handle activate command
            if msg_type == "activate":
                await handle_activate(websocket, command_id, forecast_id, data)
                continue

            # Handle job_status command
            if msg_type == "job_status":
                await handle_job_status(websocket, command_id, forecast_id)
                continue

            # Handle job_logs command
            if msg_type == "job_logs":
                await handle_job_logs(websocket, command_id, forecast_id, data)
                continue

            # Handle subscribe_predictions or job_listen command (both supported for compatibility)
            if msg_type == "subscribe_predictions" or msg_type == "job_listen":
                # For job_listen, modelType is at top level (ThingsBoard pattern)
                model_type = (
                    message.get("modelType")
                    if msg_type == "job_listen"
                    else data.get("modelType", "anomaly")
                )

                if forecast_id not in prediction_subscriptions:
                    prediction_subscriptions[forecast_id] = set()

                prediction_subscriptions[forecast_id].add(model_type)

                # Initialize last iteration tracker
                model_id = (
                    f"{forecast_id}/{model_type}_predictor"
                    if model_type == "anomaly"
                    else f"{forecast_id}/forecast_model"
                )
                job_status = get_job_status(model_id)
                if job_status:
                    last_iterations[model_id] = job_status.get("iterations", 0)

                await websocket.send_json(
                    {
                        "commandId": command_id,
                        "type": "response",
                        "model": model_type,
                        "forecastId": forecast_id,
                        "data": {
                            "status": "listening",
                            "message": f"Now listening to {model_type} predictions for {forecast_id}",
                            "current_iteration": (
                                job_status.get("iterations", 0) if job_status else 0
                            ),
                        },
                        "timestamp": datetime.now().isoformat() + "Z",
                    }
                )
                continue

            # Handle unsubscribe_predictions command
            if msg_type == "unsubscribe_predictions":
                model_type = data.get("modelType", "anomaly")

                if forecast_id in prediction_subscriptions:
                    prediction_subscriptions[forecast_id].discard(model_type)
                    if not prediction_subscriptions[forecast_id]:
                        del prediction_subscriptions[forecast_id]

                await websocket.send_json(
                    {
                        "commandId": command_id,
                        "type": "response",
                        "message": f"Unsubscribed from {model_type} predictions for {forecast_id}",
                        "timestamp": datetime.now().isoformat() + "Z",
                    }
                )
                continue

            # Handle subscribe_logs command
            if msg_type == "subscribe_logs":
                log_subscriptions.add(forecast_id)
                model_id = f"{forecast_id}/anomaly_predictor"

                # Create a real-time callback for this WebSocket connection
                def create_log_callback(ws, fid, loop):
                    def log_callback(log_entry):
                        """Callback to send log immediately when it's created (thread-safe)"""
                        try:
                            # Schedule coroutine in the event loop from another thread
                            asyncio.run_coroutine_threadsafe(
                                ws.send_json(
                                    {
                                        "type": "logs",
                                        "forecastId": fid,
                                        "data": {
                                            "logs": [
                                                {
                                                    "timestamp": log_entry["timestamp"],
                                                    "level": log_entry["level"],
                                                    "message": log_entry["message"],
                                                }
                                            ]
                                        },
                                        "timestamp": datetime.now().isoformat() + "Z",
                                    }
                                ),
                                loop,
                            )
                        except Exception as e:
                            logger.error(f"Error sending real-time log: {str(e)}")

                    return log_callback

                # Store the callback and subscribe (pass the event loop)
                callback = create_log_callback(
                    websocket, forecast_id, asyncio.get_event_loop()
                )
                log_callbacks[model_id] = callback
                subscribe_to_logs(model_id, callback)

                logger.info(
                    f"Client subscribed to real-time logs for forecast {forecast_id}"
                )
                print(
                    f"[LOG SUBSCRIBE] Client subscribed to real-time logs for forecast {forecast_id}"
                )

                await websocket.send_json(
                    {
                        "commandId": command_id,
                        "type": "response",
                        "message": f"Subscribed to real-time logs for {forecast_id}",
                        "timestamp": datetime.now().isoformat() + "Z",
                    }
                )
                continue

            # Handle unsubscribe_logs command
            if msg_type == "unsubscribe_logs":
                log_subscriptions.discard(forecast_id)
                model_id = f"{forecast_id}/anomaly_predictor"

                # Unsubscribe the callback if it exists
                if model_id in log_callbacks:
                    unsubscribe_from_logs(model_id, log_callbacks[model_id])
                    del log_callbacks[model_id]

                await websocket.send_json(
                    {
                        "commandId": command_id,
                        "type": "response",
                        "message": f"Unsubscribed from logs for {forecast_id}",
                        "timestamp": datetime.now().isoformat() + "Z",
                    }
                )
                continue

            # Handle stop_job command
            if msg_type == "stop_job":
                model_id = f"{forecast_id}/anomaly_predictor"
                success = stop_prediction_job(model_id)

                await websocket.send_json(
                    {
                        "commandId": command_id,
                        "type": "response",
                        "message": (
                            f"Job stopped for {forecast_id}"
                            if success
                            else f"No active job found for {forecast_id}"
                        ),
                        "success": success,
                        "timestamp": datetime.now().isoformat() + "Z",
                    }
                )
                continue

            # Handle connection command (from Java backend)
            if msg_type == "connection":
                # Java backend sends connection confirmation, just acknowledge
                logger.info("Received connection message from Java backend")
                continue

            # Unknown command type
            await websocket.send_json(
                {
                    "commandId": command_id,
                    "type": "error",
                    "message": f"Unknown command type: {msg_type}",
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )

    except WebSocketDisconnect:
        logger.info("Unified WebSocket client disconnected")
    except Exception as e:
        logger.error(f"Error in unified WebSocket: {str(e)}", exc_info=True)
        try:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": str(e),
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )
        except:
            pass
    finally:
        # Cancel updater task
        if "updater_task" in locals():
            updater_task.cancel()

        # Clean up all log subscriptions for this connection
        for model_id, callback in log_callbacks.items():
            try:
                unsubscribe_from_logs(model_id, callback)
            except Exception as e:
                logger.error(f"Error unsubscribing from logs on cleanup: {str(e)}")

        logger.info("Unified WebSocket connection closed")


async def handle_activate(
    websocket: WebSocket, command_id: int, forecast_id: str, data: dict
):
    """Handle model activation (training) command"""
    print(
        f"[ACTIVATE] Received activate command - commandId: {command_id}, forecastId: {forecast_id}, data: {data}"
    )
    logger.info(f"[ACTIVATE] Starting model activation for forecast {forecast_id}")

    try:
        # Send progress: initializing
        await websocket.send_json(
            {
                "commandId": command_id,
                "type": "progress",
                "step": "initializing",
                "message": "Initializing data registry...",
                "progress": 5,
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )
        print(f"[ACTIVATE] Sent initializing progress message")

        # Run synchronous data registry creation in thread pool to avoid blocking event loop

        data_registry = await asyncio.to_thread(get_data_registry)
        print(f"[ACTIVATE] Data registry initialized")

        # Fetch device_id from configuration
        device_id = data.get("deviceId")
        print(f"[ACTIVATE] Device ID from data: {device_id}")

        await websocket.send_json(
            {
                "commandId": command_id,
                "type": "progress",
                "step": "fetching_config",
                "message": "Fetching device configuration...",
                "progress": 10,
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )

        print(f"[ACTIVATE] About to fetch model config for forecast_id: {forecast_id}")
        try:
            model_config = data_registry.fetch_predictive_model_config(forecast_id)
            print(f"[ACTIVATE] Model config fetched: {model_config}")
            device_id = model_config["device_id"]
            print(f"[ACTIVATE] Device ID from config: {device_id}")
        except Exception as e:
            print(f"[ACTIVATE ERROR] Failed to fetch configuration: {str(e)}")

            traceback.print_exc()
            await websocket.send_json(
                {
                    "commandId": command_id,
                    "type": "error",
                    "message": f"Failed to fetch configuration: {str(e)}",
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )
            return

        # Train AnomalyPredictor
        await websocket.send_json(
            {
                "commandId": command_id,
                "type": "progress",
                "step": "training_anomaly",
                "message": "Training AnomalyPredictor...",
                "progress": 20,
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )

        try:
            print(f"[ACTIVATE] Model config: {model_config}", flush=True)
            algorithm = model_config.get("anomaly_algorithm", None)
            print(f"[ACTIVATE] Starting anomaly predictor training...", flush=True)
            anomaly_result = await asyncio.to_thread(
                train_and_save_model,
                model_id=f"{forecast_id}/anomaly_predictor",
                model_type="AnomalyPredictor",
                device_id=device_id,
                data_registry=data_registry,
                algorithm=algorithm,
                days_back=90,
            )
            print(
                f"[ACTIVATE] Anomaly predictor training completed: {anomaly_result}",
                flush=True,
            )

            await websocket.send_json(
                {
                    "commandId": command_id,
                    "type": "progress",
                    "step": "anomaly_complete",
                    "message": "AnomalyPredictor trained successfully",
                    "progress": 50,
                    "metrics": anomaly_result.get("training_results", {}),
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )
        except Exception as e:

            error_trace = traceback.format_exc()
            print(f"[ACTIVATE ERROR] Training failed: {str(e)}", flush=True)
            print(f"[ACTIVATE ERROR] Traceback:\n{error_trace}", flush=True)
            await websocket.send_json(
                {
                    "commandId": command_id,
                    "type": "error",
                    "step": "anomaly_failed",
                    "message": f"AnomalyPredictor training failed: {str(e)}",
                    "progress": 50,
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )
            return  # Stop activation on training failure

        # return
        # Start prediction job
        print(f"[ACTIVATE] Starting prediction job...")
        await asyncio.to_thread(
            start_prediction_job,
            f"{forecast_id}/anomaly_predictor",
            "AnomalyPredictor",
            device_id,
        )
        print(f"[ACTIVATE] Prediction job started")

        # Send completion
        await websocket.send_json(
            {
                "commandId": command_id,
                "type": "complete",
                "message": "Model activation complete",
                "forecastId": forecast_id,
                "progress": 100,
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )

    except Exception as e:
        logger.error(f"Error in activate handler: {str(e)}", exc_info=True)
        await websocket.send_json(
            {
                "commandId": command_id,
                "type": "error",
                "message": str(e),
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )


async def handle_job_status(websocket: WebSocket, command_id: int, forecast_id: str):
    """Handle job status request"""
    print(
        f"[JOB STATUS] Received job status request - commandId: {command_id}, forecastId: {forecast_id}"
    )
    try:
        model_id = f"{forecast_id}/anomaly_predictor"
        job_status = get_job_status(model_id)

        if job_status:
            await websocket.send_json(
                {
                    "commandId": command_id,
                    "type": "response",
                    "model": "job",
                    "data": job_status,
                    "forecastId": forecast_id,
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )
        else:
            path = f"{forecast_id}/anomaly_predictor"
            await websocket.send_json(
                {
                    "commandId": command_id,
                    "type": "response",
                    "model": "job",
                    "forecastId": forecast_id,
                    "data": {
                        "status": "inactive",
                        # check if model files exist
                        "model_exists": (Path(settings.models_path) / path).exists(),
                    },
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )
    except Exception as e:
        await websocket.send_json(
            {
                "commandId": command_id,
                "type": "error",
                "message": str(e),
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )


async def handle_job_logs(
    websocket: WebSocket, command_id: int, forecast_id: str, data: dict
):
    """Handle job logs request"""
    try:
        limit = data.get("limit", 100)
        model_id = f"{forecast_id}/anomaly_predictor"
        logs = get_model_logs(model_id, "all", limit)

        await websocket.send_json(
            {
                "commandId": command_id,
                "type": "response",
                "data": {"logs": logs, "count": len(logs)},
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )
    except Exception as e:
        await websocket.send_json(
            {
                "commandId": command_id,
                "type": "error",
                "message": str(e),
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )
