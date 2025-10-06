"""
Time series forecasting algorithm adapters.
"""

from .prophet import ProphetAdapter
from .xgboost_ts import XGBoostTimeSeriesAdapter

__all__ = [
    "ProphetAdapter",
    "XGBoostTimeSeriesAdapter",
]
