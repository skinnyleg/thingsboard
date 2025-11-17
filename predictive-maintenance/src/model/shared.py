"""
Shared utilities and constants for model services
"""

from datetime import datetime
import os
from pathlib import Path
from library import AnomalyPredictor, ForecastModel
from library.core.data_registry import DataRegistry
from src.settings import settings
from src.logger import logger  # Global logger
from library.models.anomaly_predictor import train_model, save_models


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
    sensors: list = None,
    group_by_ms_per_sensor: dict = None,
    aggregation_funcs: dict = None,
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
            f"Unknown model_type: {model_type}. Supported types: {list(MODEL_TYPE_MAP.keys())}"
        )

    ModelClass, default_algorithm, default_hyperparams = MODEL_TYPE_MAP[model_type]

    # Use defaults if not provided
    algorithm = algorithm or default_algorithm
    hyperparams = hyperparams or default_hyperparams
    device_id = device_id or model_id

    # Create data registry if not provided
    if data_registry is None:
        data_registry = get_data_registry()

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
        device_id=device_id,
        additional_info=kwargs,
        sensors=sensors,
        group_by_ms_per_sensor=group_by_ms_per_sensor,
        aggregation_funcs=aggregation_funcs,
    )

    # Train model
    if model_type == "AnomalyPredictor":
        telemetry_df, failures_df, maintenance_df, machines_df, errors_df = model.fetch(
            device_id=device_id, start_date=datetime(2014, 1, 1)
        )
        if failures_df.empty:
            return {
                "status": "failed",
                "reason": "No failure data found",
                "model_id": model_id,
                "model_type": model_type,
            }
        hourly_models, feature_cols, labeled_features_clean = train_model(
            telemetry_df,
            errors_df,
            maintenance_df,
            failures_df,
            machines_df,
            components=[
                "comp1",
                "comp2",
                "comp3",
                "comp4",
            ],
            error_classes=[
                "error1",
                "error2",
                "error3",
                "error4",
                "error5",
            ],
            # algorithm=algorithm,
            algorithm="random_forest",
        )
        save_models(hourly_models, model_dir)
    elif model_type == "ForecastModel":
        model.train()
        model.save(model_dir)
    return {
        "status": "success",
        "model_id": model_id,
        "model_type": model_type,
        "model_path": str(model_dir),
        "training_results": {},
    }
