"""
Job management system for background prediction workers
"""

import logging
import threading
from pathlib import Path
from datetime import datetime
from collections import deque
from typing import Dict, Callable, Set
from library import AnomalyPredictor, ForecastModel
from src.settings import settings

logger = logging.getLogger(__name__)

# Global job registry: {model_id: {status, thread, start_time, etc}}
active_jobs: Dict[str, dict] = {}
job_lock = threading.Lock()

# Log storage: {model_id: deque of log entries}
model_logs: Dict[str, deque] = {}
MAX_LOG_ENTRIES = 1000

# WebSocket log broadcasters: {model_id: set of callback functions}
log_broadcasters: Dict[str, Set[Callable]] = {}
broadcaster_lock = threading.Lock()


def add_model_log(model_id: str, level: str, message: str):
    """Add log entry for a model and broadcast to WebSocket subscribers"""
    if model_id not in model_logs:
        model_logs[model_id] = deque(maxlen=MAX_LOG_ENTRIES)

    log_entry = {
        "timestamp": datetime.now().isoformat() + "Z",
        "level": level.upper(),
        "message": message,
    }
    model_logs[model_id].append(log_entry)

    # Also log to standard logger
    if level.lower() == "error":
        logger.error(f"[{model_id}] {message}")
    elif level.lower() == "warn":
        logger.warning(f"[{model_id}] {message}")
    else:
        logger.info(f"[{model_id}] {message}")

    # Broadcast to WebSocket subscribers (non-blocking)
    with broadcaster_lock:
        if model_id in log_broadcasters:
            for broadcast_callback in log_broadcasters[model_id].copy():
                try:
                    broadcast_callback(log_entry)
                except Exception as e:
                    logger.error(f"Error broadcasting log to WebSocket: {str(e)}")


def prediction_job_worker(model_id: str, model_type: str, device_id: str = None):
    """
    Background worker that runs predictions periodically.

    For AnomalyPredictor: Checks for anomalies every 5 minutes
    For ForecastModel: Generates forecasts every 1 hour
    """
    print(f"[PREDICTION JOB] {model_id} - Worker thread started for {model_type}, device_id={device_id}", flush=True)
    add_model_log(model_id, "info", f"Prediction job started for {model_type}")

    try:
        # Load model
        print(f"[PREDICTION JOB] {model_id} - Initializing model worker", flush=True)
        add_model_log(model_id, "info", f"Initializing model worker for {model_type}")
        path = settings.models_path
        model_dir = Path(path) / model_id
        add_model_log(model_id, "info", f"Model directory: {model_dir}")

        if model_type == "AnomalyPredictor":
            add_model_log(model_id, "info", "Getting data registry...")
            # Get data registry for fetching real-time data
            from src.model.shared import get_data_registry
            data_registry = get_data_registry()
            add_model_log(model_id, "info", f"Data registry obtained: {data_registry is not None}")

            add_model_log(model_id, "info", "Creating AnomalyPredictor instance...")
            model = AnomalyPredictor(
                name=model_id,
                algorithm_name="xgboost",
                data_registry=data_registry
            )
            add_model_log(model_id, "info", "AnomalyPredictor created successfully")

            add_model_log(model_id, "info", f"Loading model from {model_dir}...")
            model.load(model_dir)
            add_model_log(model_id, "info", "Model loaded successfully from disk")

            # interval = 300  # 5 minutes
            interval = 20  # 20 seconds for testing

        elif model_type == "ForecastModel":
            model = ForecastModel(name=model_id, algorithm_name="prophet")
            model.load(model_dir)
            interval = 3600  # 1 hour
        else:
            add_model_log(model_id, "error", f"Unknown model type: {model_type}")
            return

        add_model_log(
            model_id,
            "info",
            f"Model loaded successfully, running predictions every {interval}s",
        )
        print(f"[PREDICTION JOB] {model_id} - Model loaded successfully, starting prediction loop with {interval}s interval", flush=True)

        # Prediction loop
        iteration = 0
        print(f"[PREDICTION JOB] {model_id} - Entering prediction loop", flush=True)
        while True:
            with job_lock:
                if (
                    model_id not in active_jobs
                    or active_jobs[model_id]["status"] != "running"
                ):
                    print(f"[PREDICTION JOB] {model_id} - Job stopped by user", flush=True)
                    add_model_log(model_id, "info", "Job stopped by user")
                    break

            try:
                iteration += 1
                print(f"[PREDICTION JOB] {model_id} - Starting iteration #{iteration}", flush=True)
                add_model_log(
                    model_id, "info", f"Running prediction iteration #{iteration}"
                )

                if model_type == "AnomalyPredictor":
                    # Fetch latest sensor data and predict
                    print(f"[PREDICTION JOB] {model_id} - Iteration {iteration}: Fetching latest data for device {device_id}", flush=True)
                    add_model_log(
                        model_id, "info", f"Fetching latest data for device {device_id}"
                    )

                    latest_data = model.fetch_latest(device_id)

                    print(f"[PREDICTION JOB] {model_id} - Fetched {len(latest_data)} rows of data", flush=True)
                    add_model_log(
                        model_id, "info", f"Fetched {len(latest_data)} rows of data"
                    )

                    if latest_data.empty:
                        print(f"[PREDICTION JOB] {model_id} - No data available for prediction", flush=True)
                        add_model_log(
                            model_id, "warn", "No data available for prediction"
                        )
                        continue

                    print(f"[PREDICTION JOB] {model_id} - Running prediction on data with columns: {list(latest_data.columns)}", flush=True)
                    add_model_log(
                        model_id, "info", f"Running prediction on data with columns: {list(latest_data.columns)}"
                    )

                    result = model.predict(latest_data)

                    print(f"[PREDICTION JOB] {model_id} - Prediction result: {result}", flush=True)
                    add_model_log(
                        model_id,
                        "prediction",
                        f"Anomaly prediction result: {result}",
                    )
                    add_model_log(
                        model_id,
                        "info",
                        f"Anomaly check completed (iteration {iteration})",
                    )

                elif model_type == "ForecastModel":
                    # Generate forecast for next 24 hours
                    result = model.forecast(periods=24, freq="H")
                    add_model_log(
                        model_id,
                        "info",
                        f"Forecast generated: {len(result.get('timestamps', []))} points",
                    )

                # Update last run time
                with job_lock:
                    if model_id in active_jobs:
                        active_jobs[model_id]["last_run"] = (
                            datetime.now().isoformat() + "Z"
                        )
                        active_jobs[model_id]["iterations"] = iteration

            except Exception as e:
                import traceback
                error_details = traceback.format_exc()
                print(f"[PREDICTION JOB] {model_id} - Prediction failed: {str(e)}", flush=True)
                print(f"[PREDICTION JOB] {model_id} - Traceback:\n{error_details}", flush=True)
                add_model_log(model_id, "error", f"Prediction failed: {str(e)}")
                add_model_log(model_id, "error", f"Traceback: {error_details}")

            # Sleep until next interval
            print(f"[PREDICTION JOB] {model_id} - Sleeping for {interval}s until next iteration", flush=True)
            threading.Event().wait(interval)

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"[PREDICTION JOB] {model_id} - Job worker crashed: {str(e)}", flush=True)
        print(f"[PREDICTION JOB] {model_id} - Crash traceback:\n{error_details}", flush=True)
        add_model_log(model_id, "error", f"Job worker crashed: {str(e)}")
    finally:
        with job_lock:
            if model_id in active_jobs:
                active_jobs[model_id]["status"] = "stopped"
        print(f"[PREDICTION JOB] {model_id} - Job worker terminated", flush=True)
        add_model_log(model_id, "info", "Job worker terminated")


def start_prediction_job(model_id: str, model_type: str, device_id: str = None) -> bool:
    """Start a prediction job for a model"""
    with job_lock:
        if model_id in active_jobs and active_jobs[model_id]["status"] == "running":
            add_model_log(model_id, "warn", "Job already running")
            return False

        # Create job thread
        job_thread = threading.Thread(
            target=prediction_job_worker,
            args=(model_id, model_type, device_id),
            daemon=True,
        )

        active_jobs[model_id] = {
            "model_id": model_id,
            "model_type": model_type,
            "device_id": device_id,
            "status": "running",
            "start_time": datetime.now().isoformat() + "Z",
            "last_run": None,
            "iterations": 0,
            "thread": job_thread,
        }

        job_thread.start()
        add_model_log(model_id, "info", f"Job started successfully")
        return True


def stop_prediction_job(model_id: str) -> bool:
    """Stop a prediction job"""
    with job_lock:
        if model_id not in active_jobs:
            return False

        active_jobs[model_id]["status"] = "stopped"
        add_model_log(model_id, "info", "Job stop requested")
        return True


def get_job_status(model_id: str = None) -> dict:
    """Get status of jobs"""
    with job_lock:
        if model_id:
            if model_id in active_jobs:
                job_info = active_jobs[model_id]
                return {
                    "model_id": job_info["model_id"],
                    "model_type": job_info["model_type"],
                    "device_id": job_info.get("device_id"),
                    "status": job_info["status"],
                    "start_time": job_info["start_time"],
                    "last_run": job_info.get("last_run"),
                    "iterations": job_info.get("iterations", 0),
                    "model_exists": True,
                }
            return None
        else:
            # Return all jobs
            return {
                model_id: {
                    "model_id": job_info["model_id"],
                    "model_type": job_info["model_type"],
                    "device_id": job_info.get("device_id"),
                    "status": job_info["status"],
                    "start_time": job_info["start_time"],
                    "last_run": job_info.get("last_run"),
                    "iterations": job_info.get("iterations", 0),
                    "model_exists": True,
                }
                for model_id, job_info in active_jobs.items()
            }


def get_model_logs(model_id: str, level: str = "all", limit: int = 100) -> list:
    """Get logs for a model"""
    if model_id not in model_logs:
        return []

    # Filter logs by level
    logs = list(model_logs[model_id])
    if level.upper() != "ALL":
        logs = [log for log in logs if log["level"] == level.upper()]

    # Apply limit (take most recent)
    logs = logs[-limit:]

    return logs


def subscribe_to_logs(model_id: str, callback: Callable) -> None:
    """
    Subscribe to real-time log updates for a model.

    Args:
        model_id: The model ID to subscribe to
        callback: Function to call when new logs are added (receives log_entry dict)
    """
    with broadcaster_lock:
        if model_id not in log_broadcasters:
            log_broadcasters[model_id] = set()
        log_broadcasters[model_id].add(callback)
        logger.info(f"WebSocket subscribed to logs for {model_id}")


def unsubscribe_from_logs(model_id: str, callback: Callable) -> None:
    """
    Unsubscribe from real-time log updates for a model.

    Args:
        model_id: The model ID to unsubscribe from
        callback: The callback function to remove
    """
    with broadcaster_lock:
        if model_id in log_broadcasters:
            log_broadcasters[model_id].discard(callback)
            if not log_broadcasters[model_id]:
                del log_broadcasters[model_id]
            logger.info(f"WebSocket unsubscribed from logs for {model_id}")
