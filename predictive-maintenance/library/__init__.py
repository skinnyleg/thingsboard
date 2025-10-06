"""
Predictive Maintenance Library

A flexible, production-ready library for predictive maintenance using machine learning.

Main Components:
- Algorithms: ML algorithm adapters (supervised, time series, unsupervised)
- Models: Business logic models (anomaly prediction, forecasting, real-time detection)
- Core: Base interfaces and shared types

Example:
    >>> from library import AnomalyPredictor, AlgorithmType
    >>>
    >>> predictor = AnomalyPredictor(algorithm_type=AlgorithmType.XGBOOST)
    >>> predictor.train(labeled_features, feature_cols)
    >>> prediction = predictor.predict_24h_failures(machine_id=1, ...)
"""

__version__ = "1.0.0"

# Import main interfaces
from .core.algorithm_interface import BaseAlgorithm, AlgorithmType, TaskType
from .core.model_interface import BaseModel
from .core.types import (
    AlgorithmConfig,
    SupervisedConfig,
    TimeSeriesConfig,
    PredictionOutput,
    TrainingMetrics,
    ForecastOutput,
)

# Import factory
from .algorithms.factory import AlgorithmRegistry

# Import models
from .models.anomaly_predictor import AnomalyPredictor
from .models.forecast_model import ForecastModel

__all__ = [
    # Version
    "__version__",
    # Core interfaces
    "BaseAlgorithm",
    "BaseModel",
    "AlgorithmType",
    "TaskType",
    # Types
    "AlgorithmConfig",
    "SupervisedConfig",
    "TimeSeriesConfig",
    "PredictionOutput",
    "TrainingMetrics",
    "ForecastOutput",
    # Factory
    "AlgorithmRegistry",
    "create_algorithm",
    # Models
    "AnomalyPredictor",
    "ForecastModel",
]
