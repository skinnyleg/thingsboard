"""
Socket server integration for ThingsBoard Java backend communication
Handles training requests, job management, and status queries
"""

import os
import json
import socket
import logging
import threading
from src.model.shared import train_and_save_model
from src.model.job import (
    start_prediction_job,
    stop_prediction_job,
    get_job_status,
    get_model_logs,
    active_jobs,
    job_lock,
)

logger = logging.getLogger(__name__)


def handle_socket_request(request_data: dict) -> dict:
    """
    Main handler for socket requests from ThingsBoard Java backend.

    Routes requests to appropriate handlers based on action.

    Supported actions:
    - train: Train and save a new model
    - start_jobs: Start prediction jobs for active models
    - stop_jobs: Stop prediction jobs
    - get_job_status: Get status of running jobs
    - get_logs: Retrieve model logs
    """
    try:
        action = request_data.get("action")

        if action == "train":
            return handle_training_request(request_data)
        elif action == "start_jobs":
            return handle_start_jobs_request(request_data)
        elif action == "stop_jobs":
            return handle_stop_jobs_request(request_data)
        elif action == "get_job_status":
            return handle_get_job_status_request(request_data)
        elif action == "get_logs":
            return handle_get_logs_request(request_data)
        else:
            return {"status": "error", "error": f"Unknown action: {action}"}
    except Exception as e:
        logger.error(f"Error handling socket request: {str(e)}", exc_info=True)
        return {"status": "error", "error": str(e)}


def handle_training_request(request_data: dict) -> dict:
    """
    Handle model training request from ThingsBoard Java backend.

    Expected request format:
    {
        "action": "train",
        "model_id": "anomaly_predictor_device123_1234567890",
        "model_type": "AnomalyPredictor" | "ForecastModel",
        "algorithm": "xgboost" | "prophet" | "arima",
        "device_id": "uuid-string" (optional, null for global models),
        "hyperparams": {...}
    }

    Response format:
    {
        "status": "success" | "error",
        "model_id": "...",
        "model_path": "/path/to/model",
        "training_results": {...metrics...},
        "error": "error message if failed"
    }
    """
    try:
        model_id = request_data.get("model_id")
        model_type = request_data.get("model_type")
        algorithm = request_data.get("algorithm")
        device_id = request_data.get("device_id")
        hyperparams = request_data.get("hyperparams", {})

        logger.info(
            f"Training request received: model_id={model_id}, type={model_type}, algorithm={algorithm}"
        )

        # Prepare kwargs based on model type
        kwargs = {"days_back": 90}

        if model_type == "ForecastModel":
            kwargs.update(
                {
                    "sensor_key": request_data.get("sensor_key", "sensor_00"),
                    "sensor_name": request_data.get(
                        "sensor_name", f"sensor_{device_id or model_id}"
                    ),
                    "time_column": request_data.get("time_column", "timestamp"),
                    "value_column": request_data.get("value_column", "value"),
                }
            )

        # Use unified training function
        result = train_and_save_model(
            model_id=model_id,
            model_type=model_type,
            device_id=device_id,
            algorithm=algorithm,
            hyperparams=hyperparams if hyperparams else None,
            **kwargs,
        )

        logger.info(
            f"Training completed: model_id={model_id}, results={result['training_results']}"
        )

        # Auto-start prediction job after successful training
        job_started = start_prediction_job(model_id, model_type, device_id)
        result["job_started"] = job_started

        return result

    except ValueError as e:
        logger.error(f"Invalid model type: {str(e)}")
        return {"status": "error", "error": str(e)}
    except Exception as e:
        logger.error(f"Training failed: {str(e)}", exc_info=True)
        return {"status": "error", "error": str(e)}


def handle_start_jobs_request(request_data: dict) -> dict:
    """
    Start prediction jobs for models.

    Request format:
    {
        "action": "start_jobs",
        "models": [
            {
                "model_id": "anomaly_predictor_device123_1696234567890",
                "model_type": "AnomalyPredictor",
                "device_id": "uuid-string"
            },
            {
                "model_id": "forecast_model_device123_1696234612890",
                "model_type": "ForecastModel",
                "device_id": "uuid-string"
            }
        ]
    }

    Response format:
    {
        "status": "success",
        "started": ["model_id1", "model_id2"],
        "already_running": ["model_id3"],
        "failed": []
    }
    """
    try:
        models = request_data.get("models", [])

        started = []
        already_running = []
        failed = []

        for model_info in models:
            model_id = model_info.get("model_id")
            model_type = model_info.get("model_type")
            device_id = model_info.get("device_id")

            if not model_id or not model_type:
                failed.append(model_id or "unknown")
                continue

            if start_prediction_job(model_id, model_type, device_id):
                started.append(model_id)
            else:
                already_running.append(model_id)

        logger.info(
            f"Started {len(started)} jobs, {len(already_running)} already running, {len(failed)} failed"
        )

        return {
            "status": "success",
            "started": started,
            "already_running": already_running,
            "failed": failed,
        }

    except Exception as e:
        logger.error(f"Failed to start jobs: {str(e)}", exc_info=True)
        return {"status": "error", "error": str(e)}


def handle_stop_jobs_request(request_data: dict) -> dict:
    """
    Stop prediction jobs.

    Request format:
    {
        "action": "stop_jobs",
        "model_ids": ["model_id1", "model_id2"]  // or "all" for all jobs
    }

    Response format:
    {
        "status": "success",
        "stopped": ["model_id1", "model_id2"],
        "not_found": ["model_id3"],
        "failed": []
    }
    """
    try:
        model_ids = request_data.get("model_ids", [])

        if model_ids == "all":
            with job_lock:
                model_ids = list(active_jobs.keys())

        stopped = []
        not_found = []

        for model_id in model_ids:
            if stop_prediction_job(model_id):
                stopped.append(model_id)
            else:
                not_found.append(model_id)

        logger.info(f"Stopped {len(stopped)} jobs, {len(not_found)} not found")

        return {
            "status": "success",
            "stopped": stopped,
            "not_found": not_found,
            "failed": [],
        }

    except Exception as e:
        logger.error(f"Failed to stop jobs: {str(e)}", exc_info=True)
        return {"status": "error", "error": str(e)}


def handle_get_job_status_request(request_data: dict) -> dict:
    """
    Get status of prediction jobs.

    Request format:
    {
        "action": "get_job_status",
        "model_ids": ["model_id1"]  // or omit for all jobs
    }

    Response format:
    {
        "status": "success",
        "jobs": {
            "model_id1": {
                "model_id": "...",
                "model_type": "AnomalyPredictor",
                "device_id": "...",
                "status": "running" | "stopped",
                "start_time": "2024-10-02T14:30:00Z",
                "last_run": "2024-10-02T14:35:00Z",
                "iterations": 3
            }
        }
    }
    """
    try:
        requested_ids = request_data.get("model_ids", None)

        if requested_ids is None:
            # Return all jobs
            jobs = get_job_status()
        else:
            # Return specific jobs
            jobs = {}
            for model_id in requested_ids:
                job_info = get_job_status(model_id)
                if job_info:
                    jobs[model_id] = job_info

        return {"status": "success", "jobs": jobs}

    except Exception as e:
        logger.error(f"Failed to get job status: {str(e)}", exc_info=True)
        return {"status": "error", "error": str(e)}


def handle_get_logs_request(request_data: dict) -> dict:
    """
    Get logs for models.

    Request format:
    {
        "action": "get_logs",
        "model_id": "anomaly_predictor_device123_1696234567890",
        "level": "info" | "warn" | "error" | "all",  // optional, default "all"
        "limit": 100  // optional, default 100
    }

    Response format:
    {
        "status": "success",
        "model_id": "...",
        "logs": [
            {
                "timestamp": "2024-10-02T14:30:00Z",
                "level": "INFO",
                "message": "Job started successfully"
            }
        ],
        "total_logs": 150
    }
    """
    try:
        model_id = request_data.get("model_id")
        level_filter = request_data.get("level", "all")
        limit = request_data.get("limit", 100)

        if not model_id:
            return {"status": "error", "error": "model_id is required"}

        logs = get_model_logs(model_id, level_filter, limit)

        return {
            "status": "success",
            "model_id": model_id,
            "logs": logs,
            "total_logs": len(logs),
        }

    except Exception as e:
        logger.error(f"Failed to get logs: {str(e)}", exc_info=True)
        return {"status": "error", "error": str(e)}


def socket_server_worker(host: str = "0.0.0.0", port: int = 9000):
    """
    Socket server that listens for model training requests from ThingsBoard.
    Runs in a separate thread.
    """
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind((host, port))
    server_socket.listen(5)

    logger.info(f"Socket server listening on {host}:{port} for model training requests")

    while True:
        try:
            client_socket, address = server_socket.accept()
            logger.info(f"Connection from {address}")

            # Read request (newline-delimited JSON)
            data = b""
            while True:
                chunk = client_socket.recv(4096)
                if not chunk:
                    break
                data += chunk
                if b"\n" in data:
                    break

            if data:
                request_json = data.decode("utf-8").strip()
                logger.debug(f"Received: {request_json}")

                request_data = json.loads(request_json)

                # Handle request (training, start_jobs, stop_jobs, get_job_status, get_logs)
                response = handle_socket_request(request_data)

                # Send response
                response_json = json.dumps(response) + "\n"
                client_socket.sendall(response_json.encode("utf-8"))
                logger.debug(f"Sent: {response_json}")

            client_socket.close()

        except Exception as e:
            logger.error(f"Socket server error: {str(e)}", exc_info=True)
            try:
                client_socket.close()
            except:
                pass


def start_socket_server():
    """Start socket server in a daemon thread"""
    socket_thread = threading.Thread(
        target=socket_server_worker, args=("0.0.0.0", 9000), daemon=True
    )
    socket_thread.start()
    logger.info("Socket server thread started")


# Auto-start socket server (can be disabled via environment variable)
if os.getenv("ENABLE_SOCKET_SERVER", "true").lower() == "true":
    start_socket_server()
