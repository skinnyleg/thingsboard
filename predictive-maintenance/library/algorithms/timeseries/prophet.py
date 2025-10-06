"""
Facebook Prophet algorithm adapter for time series forecasting.
"""

from typing import Optional
import pandas as pd
import numpy as np
from prophet import Prophet
from datetime import datetime, timedelta
import time

from ...core.algorithm_interface import BaseAlgorithm
from ...core.types import (
    TimeSeriesConfig,
    PredictionOutput,
    TrainingMetrics,
    ForecastOutput,
    AlgorithmCapabilities,
)


class ProphetAdapter(BaseAlgorithm):
    """Adapter for Facebook Prophet time series forecasting"""

    def __init__(self, config: TimeSeriesConfig):
        super().__init__(config)
        self.config: TimeSeriesConfig = config

    def _define_capabilities(self) -> AlgorithmCapabilities:
        return AlgorithmCapabilities(
            supports_classification=False,
            supports_regression=False,
            supports_time_series=True,
            supports_feature_importance=False,
            supports_probability=False,
            supports_incremental_learning=False,
            requires_scaling=False,
            handles_missing_values=True,
            handles_categorical=False,
        )

    def train(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> TrainingMetrics:
        """
        Train Prophet model on time series data.

        Expected data format:
        - X must have columns: 'ds' (timestamp) and 'y' (value)
        - Or use config.time_column and config.value_column
        """
        start_time = time.time()

        # Prepare data for Prophet
        if "ds" not in X.columns or "y" not in X.columns:
            df = X.copy()
            df = df.rename(
                columns={self.config.time_column: "ds", self.config.value_column: "y"}
            )
        else:
            df = X.copy()

        # Ensure ds is datetime
        df["ds"] = pd.to_datetime(df["ds"])

        # Create and train Prophet model
        self.model = Prophet(
            seasonality_mode=self.config.seasonality_mode,
            changepoint_prior_scale=self.config.changepoint_prior_scale,
            **self.config.hyperparameters
        )

        self.model.fit(df)
        self.is_trained = True

        # Calculate training metrics
        metrics = TrainingMetrics(training_time=time.time() - start_time)

        # Make in-sample predictions for metrics
        forecast = self.model.predict(df)
        y_true = df["y"].values
        y_pred = forecast["yhat"].values

        # Calculate error metrics
        metrics.mae = float(np.mean(np.abs(y_true - y_pred)))
        metrics.rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))

        # R² score
        ss_res = np.sum((y_true - y_pred) ** 2)
        ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
        metrics.r2_score = float(1 - (ss_res / ss_tot)) if ss_tot != 0 else 0.0

        self.training_metrics = metrics
        return metrics

    def predict(self, X: pd.DataFrame) -> PredictionOutput:
        """
        Make predictions on new timestamps.

        Args:
            X: DataFrame with 'ds' column containing timestamps
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        # Prepare data
        if "ds" not in X.columns:
            df = X.copy()
            df = df.rename(columns={self.config.time_column: "ds"})
        else:
            df = X.copy()

        df["ds"] = pd.to_datetime(df["ds"])

        # Make predictions
        forecast = self.model.predict(df)
        predictions = forecast["yhat"].values

        return PredictionOutput(
            predictions=predictions,
            metadata={
                "algorithm": "prophet",
                "n_samples": len(X),
                "lower_bound": forecast["yhat_lower"].values.tolist(),
                "upper_bound": forecast["yhat_upper"].values.tolist(),
            },
        )

    def forecast(self, periods: int, freq: str = "H", **kwargs) -> ForecastOutput:
        """
        Make future forecasts.

        Args:
            periods: Number of time periods to forecast
            freq: Frequency of forecasts ('H' for hourly, 'D' for daily, etc.)
            **kwargs: Additional parameters
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before forecasting")

        # Create future dataframe
        future = self.model.make_future_dataframe(periods=periods, freq=freq)

        # Make forecast
        forecast = self.model.predict(future)

        # Get only future predictions
        forecast_future = forecast.tail(periods)

        return ForecastOutput(
            timestamps=forecast_future["ds"].tolist(),
            forecasted_values=forecast_future["yhat"].values,
            lower_bound=forecast_future["yhat_lower"].values,
            upper_bound=forecast_future["yhat_upper"].values,
            confidence_level=0.95,  # Prophet uses 95% confidence intervals by default
            metadata={"algorithm": "prophet", "freq": freq, "periods": periods},
        )
