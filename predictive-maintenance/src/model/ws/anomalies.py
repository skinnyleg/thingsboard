"""
WebSocket endpoint: /ws/{forecast_id}/anomalies
Real-time anomaly streaming endpoint for active prediction jobs
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, WebSocketException
from datetime import datetime
import asyncio
import logging
from src.model.job import get_job_status, model_logs

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/{forecast_id}/anomalies")
async def anomalies_stream(websocket: WebSocket, forecast_id: str):
    """
    WebSocket endpoint for streaming real-time anomalies from an active prediction job.

    The Java backend connects to this endpoint to receive anomaly updates.
    This endpoint requires an active job to be running for the given forecast_id.
    """
    # First check if there's an active job for this forecast
    model_id = f"{forecast_id}/anomaly_predictor"
    job_status = get_job_status(model_id)

    if not job_status or job_status.get("status") != "running":
        logger.error(f"No active job found for forecastId: {forecast_id}")
        # Return 403 to indicate forbidden access (no active job)
        raise WebSocketException(code=403, reason=f"No active job found for forecastId: {forecast_id}")

    await websocket.accept()

    logger.info(f"Anomaly stream connected for forecast {forecast_id}")

    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connection",
            "message": f"Connected to anomaly stream for forecast {forecast_id}",
            "forecast_id": forecast_id,
            "timestamp": datetime.now().isoformat() + "Z"
        })

        # Track the last log index we've sent
        last_log_index = 0

        while True:
            # Check if job is still running
            job_status = get_job_status(model_id)
            if not job_status or job_status.get("status") != "running":
                await websocket.send_json({
                    "type": "job_stopped",
                    "message": "Prediction job has stopped",
                    "timestamp": datetime.now().isoformat() + "Z"
                })
                break

            # Get new logs/anomalies from the model
            if model_id in model_logs:
                logs = list(model_logs[model_id])

                # Send any new log entries as anomaly updates
                if len(logs) > last_log_index:
                    for log_entry in logs[last_log_index:]:
                        # Format log as anomaly update
                        await websocket.send_json({
                            "type": "anomaly_update",
                            "forecast_id": forecast_id,
                            "log": log_entry,
                            "timestamp": log_entry.get("timestamp")
                        })

                    last_log_index = len(logs)

            # Send periodic heartbeat
            await websocket.send_json({
                "type": "heartbeat",
                "job_status": job_status.get("status"),
                "iterations": job_status.get("iterations", 0),
                "timestamp": datetime.now().isoformat() + "Z"
            })

            # Wait before next check (5 seconds)
            await asyncio.sleep(5)

    except WebSocketDisconnect:
        logger.info(f"Client disconnected from anomaly stream for forecast {forecast_id}")
    except Exception as e:
        logger.error(f"Error in anomaly stream for forecast {forecast_id}: {str(e)}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e),
                "timestamp": datetime.now().isoformat() + "Z"
            })
        except:
            pass
    finally:
        logger.info(f"Anomaly stream closed for forecast {forecast_id}")
