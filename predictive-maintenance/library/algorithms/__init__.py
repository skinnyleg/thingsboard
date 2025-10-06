"""
Algorithms module - Algorithm implementations and factory.
"""

from .factory import AlgorithmRegistry
from .supervised import (
    RandomForestAdapter,
    XGBoostAdapter,
    LightGBMAdapter,
    CatBoostAdapter,
    LogisticRegressionAdapter,
)
from .timeseries import ProphetAdapter, XGBoostTimeSeriesAdapter

__all__ = [
    "AlgorithmRegistry",
    "RandomForestAdapter",
    "XGBoostAdapter",
    "LightGBMAdapter",
    "CatBoostAdapter",
    "LogisticRegressionAdapter",
    "ProphetAdapter",
    "XGBoostTimeSeriesAdapter",
]
