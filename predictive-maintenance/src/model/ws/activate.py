"""
WebSocket endpoint: /ws/{forecast_id}/activate
Train and activate models with real-time progress updates
"""

from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from src.model.shared import get_data_registry, train_and_save_model

router = APIRouter()


@router.websocket("/ws/{forecast_id}/activate")
async def activate_model_stream(websocket: WebSocket, forecast_id: str):
    """
    WebSocket endpoint to activate models with real-time progress updates.

    Training can take several minutes, so this streams progress to the client.

    Client connects and receives messages like:
    {
        "type": "progress",
        "step": "fetching_config",
        "message": "Fetching device configuration...",
        "progress": 10
    }

    Final message:
    {
        "type": "complete",
        "forecast_id": "...",
        "device_id": "...",
        "training_results": {...}
    }
    """
    await websocket.accept()

    try:
        # Send connection confirmation
        await websocket.send_json(
            {
                "type": "connection",
                "message": f"Connected to activation stream for forecast {forecast_id}",
                "forecast_id": forecast_id,
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )

        # Initialize data registry
        await websocket.send_json(
            {
                "type": "progress",
                "step": "initializing",
                "message": "Initializing data registry...",
                "progress": 5,
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )

        data_registry = get_data_registry()

        # Fetch device_id from predictive maintenance configuration
        await websocket.send_json(
            {
                "type": "progress",
                "step": "fetching_config",
                "message": "Fetching device configuration...",
                "progress": 10,
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )

        try:
            model_config = data_registry.fetch_predictive_model_config(forecast_id)
            device_id = model_config["device_id"]

            await websocket.send_json(
                {
                    "type": "progress",
                    "step": "config_fetched",
                    "message": f"Configuration fetched for device: {device_id}",
                    "progress": 15,
                    "device_id": device_id,
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )

        except Exception as e:
            await websocket.send_json(
                {
                    "type": "error",
                    "step": "config_fetch_failed",
                    "message": f"Failed to fetch configuration: {str(e)}",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )
            await websocket.close(code=1008, reason="Configuration not found")
            return

        training_results = {}

        # ====== Train and Save AnomalyPredictor ======
        await websocket.send_json(
            {
                "type": "progress",
                "step": "training_anomaly_start",
                "message": "Starting AnomalyPredictor training...",
                "progress": 20,
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )

        try:
            await websocket.send_json(
                {
                    "type": "progress",
                    "step": "fetching_anomaly_data",
                    "message": "Fetching training data for AnomalyPredictor (90 days)...",
                    "progress": 25,
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )

            anomaly_result = train_and_save_model(
                model_id=f"{forecast_id}/anomaly_predictor",
                model_type="AnomalyPredictor",
                device_id=device_id,
                data_registry=data_registry,
                days_back=90,
            )

            training_results["anomaly_predictor"] = anomaly_result

            metrics = anomaly_result["training_results"]
            await websocket.send_json(
                {
                    "type": "progress",
                    "step": "anomaly_complete",
                    "message": f"AnomalyPredictor trained successfully",
                    "progress": 50,
                    "metrics": {
                        "accuracy": metrics["average_accuracy"],
                        "f1_score": metrics["average_f1_score"],
                        "training_time": metrics["training_time"],
                    },
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )

        except Exception as e:
            training_results["anomaly_predictor"] = {
                "status": "failed",
                "error": str(e),
            }

            await websocket.send_json(
                {
                    "type": "progress",
                    "step": "anomaly_failed",
                    "message": f"AnomalyPredictor training failed: {str(e)}",
                    "progress": 50,
                    "error": str(e),
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )

        # ====== Train and Save ForecastModel ======
        await websocket.send_json(
            {
                "type": "progress",
                "step": "training_forecast_start",
                "message": "Starting ForecastModel training...",
                "progress": 55,
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )

        try:
            await websocket.send_json(
                {
                    "type": "progress",
                    "step": "fetching_forecast_data",
                    "message": "Fetching training data for ForecastModel (90 days)...",
                    "progress": 60,
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )

            forecast_result = train_and_save_model(
                model_id=f"{forecast_id}/forecast_model",
                model_type="ForecastModel",
                device_id=device_id,
                data_registry=data_registry,
                sensor_key="sensor_00",
                sensor_name=f"sensor_{forecast_id}",
                days_back=90,
                time_column="timestamp",
                value_column="value",
            )

            training_results["forecast_model"] = forecast_result

            metrics = forecast_result["training_results"]
            await websocket.send_json(
                {
                    "type": "progress",
                    "step": "forecast_complete",
                    "message": f"ForecastModel trained successfully",
                    "progress": 95,
                    "metrics": {
                        "rmse": metrics["rmse"],
                        "r2_score": metrics["r2_score"],
                        "training_time": metrics["training_time"],
                    },
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )

        except Exception as e:
            training_results["forecast_model"] = {"status": "failed", "error": str(e)}

            await websocket.send_json(
                {
                    "type": "progress",
                    "step": "forecast_failed",
                    "message": f"ForecastModel training failed: {str(e)}",
                    "progress": 95,
                    "error": str(e),
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )

        # Check if at least one model was trained successfully
        success_count = sum(
            1
            for result in training_results.values()
            if result.get("status") == "success"
        )

        if success_count == 0:
            await websocket.send_json(
                {
                    "type": "error",
                    "step": "all_failed",
                    "message": "Failed to train any models",
                    "progress": 100,
                    "training_results": training_results,
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )
            await websocket.close(code=1011, reason="Training failed")
            return

        # Send completion message
        await websocket.send_json(
            {
                "type": "complete",
                "step": "activation_complete",
                "message": f"Successfully trained and saved {success_count}/2 models",
                "progress": 100,
                "forecast_id": forecast_id,
                "device_id": device_id,
                "status": "active",
                "models_trained": success_count,
                "training_results": training_results,
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )

        # Keep connection open for a moment to ensure client receives final message
        await websocket.send_json(
            {
                "type": "done",
                "message": "Activation complete, closing connection",
                "timestamp": datetime.now().isoformat() + "Z",
            }
        )

        await websocket.close(code=1000, reason="Activation complete")

    except WebSocketDisconnect:
        print(f"Client disconnected from activation stream for forecast {forecast_id}")
    except Exception as e:
        print(f"Error in activation stream: {str(e)}")
        try:
            await websocket.send_json(
                {
                    "type": "error",
                    "step": "unexpected_error",
                    "message": f"Unexpected error: {str(e)}",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat() + "Z",
                }
            )
            await websocket.close(code=1011, reason=str(e))
        except:
            pass
