"""
Core module - Base interfaces and types for the library
"""

from .algorithm_interface import BaseAlgorithm, AlgorithmType, TaskType
from .model_interface import BaseModel
from .types import (
    AlgorithmConfig,
    SupervisedConfig,
    TimeSeriesConfig,
    NeuralNetworkConfig,
    PredictionOutput,
    TrainingMetrics,
    ForecastOutput,
    AlgorithmCapabilities,
)

__all__ = [
    "BaseAlgorithm",
    "BaseModel",
    "AlgorithmType",
    "TaskType",
    "AlgorithmConfig",
    "SupervisedConfig",
    "TimeSeriesConfig",
    "NeuralNetworkConfig",
    "PredictionOutput",
    "TrainingMetrics",
    "ForecastOutput",
    "AlgorithmCapabilities",
]
