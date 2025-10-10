"""
Shared utilities and constants for model services
"""

from datetime import datetime
import os
import logging
from pathlib import Path
from typing import Dict
from library import AnomalyPredictor, ForecastModel
from library.core.data_registry import DataRegistry
from src.settings import settings

logger = logging.getLogger(__name__)


def get_data_registry() -> DataRegistry:
    """
    Get or create DataRegistry instance.

    Returns:
        DataRegistry instance configured with database URL and telemetry keys
    """
    # Get database URL from settings or environment
    database_url = os.getenv(
        "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/thingsboard"
    )

    # Get telemetry configuration from settings
    from src.settings import settings

    return DataRegistry(
        database_url=database_url,
        telemetry_keys=settings.telemetry_keys,
        error_keys=settings.error_keys,
        component_keys=settings.component_keys,
    )


# Model type mapping: model_type -> (ModelClass, default_algorithm, default_hyperparams)
MODEL_TYPE_MAP = {
    "AnomalyPredictor": (
        AnomalyPredictor,
        "random_forest",
        {
            "n_estimators": 100,
            "max_depth": 12,
            "min_samples_split": 8,
            "min_samples_leaf": 4,
            "class_weight": "balanced",
            "n_jobs": -1,
            "random_state": 42,
        },
    ),
    "ForecastModel": (
        ForecastModel,
        "prophet",
        {"seasonality_mode": "multiplicative", "changepoint_prior_scale": 0.05},
    ),
}

training_results = None


def train_and_save_model(
    model_id: str,
    model_type: str,
    device_id: str = None,
    algorithm: str = None,
    hyperparams: dict = None,
    data_registry: DataRegistry = None,
    **kwargs,
) -> dict:
    """
    Unified function to train and save any model type.

    Args:
        model_id: Unique identifier for the model
        model_type: Type of model ("AnomalyPredictor" or "ForecastModel")
        device_id: Device identifier (optional, uses model_id if not provided)
        algorithm: Algorithm name (optional, uses default for model type)
        hyperparams: Hyperparameters (optional, uses default for model type)
        data_registry: DataRegistry instance for database access (optional)
        **kwargs: Additional parameters passed to model.fetch()

    Returns:
        Dictionary with training results

    Raises:
        ValueError: If model_type is not recognized
    """
    # Get model class and defaults from map
    if model_type not in MODEL_TYPE_MAP:
        raise ValueError(
            f"Unknown model_type: {model_type}. "
            f"Supported types: {list(MODEL_TYPE_MAP.keys())}"
        )

    ModelClass, default_algorithm, default_hyperparams = MODEL_TYPE_MAP[model_type]

    # Use defaults if not provided
    algorithm = algorithm or default_algorithm
    hyperparams = hyperparams or default_hyperparams
    device_id = device_id or model_id

    # Create data registry if not provided
    if data_registry is None:
        data_registry = get_data_registry()

    logger.info(f"Training {model_type}: model_id={model_id}, algorithm={algorithm}")

    # Create model directory
    path = settings.models_path
    model_dir = Path(path) / model_id
    model_dir.mkdir(parents=True, exist_ok=True)

    # Initialize model with data registry
    model = ModelClass(
        name=model_id,
        algorithm_name=algorithm,
        algorithm_hyperparams=hyperparams,
        data_registry=data_registry,
    )

    # Fetch training data using model's fetch method
    train_data = model.fetch(device_id=device_id, **kwargs)
    logger.info(f"Fetched {len(train_data)} samples for training")

    # Train model
    if model_type == "AnomalyPredictor":
        # results = model.train(train_data)
        # training_results = {
        #     "average_accuracy": results["overall"]["average_accuracy"],
        #     "average_f1_score": results["overall"]["average_f1_score"],
        #     "training_time": results["overall"]["total_training_time"],
        # }
        # print(
        #     f"[TRAIN_AND_SAVE] AnomalyPredictor training results: {training_results}",
        #     flush=True,
        # )

        # fetch raw data and train using existing function
        telemetry_df, failures_df, maintenance_df, machines_df, errors_df = model.fetch_raw_data(
                device_id=device_id,
                start_date=datetime(2014, 1, 1)
            )

        # print all dataframes
        print("[TRAIN_AND_SAVE] telemetry_df:", flush=True)
        print(telemetry_df.head(), flush=True)
        print(telemetry_df.dtypes, flush=True)
        print("[TRAIN_AND_SAVE] failures_df:", flush=True)
        print(failures_df.head(), flush=True)
        print(failures_df.dtypes, flush=True)
        print("[TRAIN_AND_SAVE] maintenance_df:", flush=True)
        print(maintenance_df.head(), flush=True)
        print(maintenance_df.dtypes, flush=True)
        print("[TRAIN_AND_SAVE] machines_df:", flush=True)
        print(machines_df.head(), flush=True)
        print(machines_df.dtypes, flush=True)
        print("[TRAIN_AND_SAVE] errors_df:", flush=True)
        print(errors_df.head(), flush=True)
        print(errors_df.dtypes, flush=True)

        # print distinct values of comp of maintenance_df
        print("[TRAIN_AND_SAVE] maintenance_df distinct comp values:", flush=True)
        print(maintenance_df["comp"].unique(), flush=True)

        # print distinct values of failure of failures_df
        print("[TRAIN_AND_SAVE] failures_df distinct failure values:", flush=True)
        print(failures_df["failure"].unique(), flush=True)

        from .Failure_prediction_Random_Forest import (
            train_model,
            predict_failure,
            save_models
        )

        hourly_models, feature_cols, labeled_features_clean = train_model(
            telemetry_df,
            errors_df,
            maintenance_df,
            failures_df,
            machines_df,
        )

        # save models
        save_models(hourly_models, model_dir)

    elif model_type == "ForecastModel":
        sensor_name = kwargs.get("sensor_name", f"sensor_{device_id}")
        time_column = kwargs.get("time_column", "timestamp")
        value_column = kwargs.get("value_column", "value")

        results = model.train(
            train_data,
            sensor_name=sensor_name,
            time_column=time_column,
            value_column=value_column,
        )
        training_results = {
            "sensor_name": results["sensor_name"],
            "mae": results["mae"],
            "rmse": results["rmse"],
            "r2_score": results["r2_score"],
            "training_time": results["training_time"],
        }

    # Save model
    print(f"[TRAIN_AND_SAVE] About to save model to {model_dir}", flush=True)
    print(
        f"[TRAIN_AND_SAVE] Model algorithms: {list(model.algorithms.keys())}",
        flush=True,
    )
    print(f"[TRAIN_AND_SAVE] Model is_trained: {model.is_trained}", flush=True)
    model.save(model_dir)
    logger.info(f"Model saved to {model_dir}")
    print(f"[TRAIN_AND_SAVE] Model save completed", flush=True)

    # return {
    #     "status": "success",
    #     "model_id": model_id,
    #     "model_type": model_type,
    #     "model_path": str(model_dir),
    #     "training_results": training_results,
    # }

    return {
        "status": "success",
        "model_id": model_id,
        "model_type": model_type,
        "model_path": str(model_dir),
        "training_results": {},
    }
