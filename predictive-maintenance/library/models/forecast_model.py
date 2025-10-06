"""
Forecast Model - Pure sensor telemetry forecasting (NOT failure prediction).

This model forecasts future sensor values using time series algorithms.
It does NOT predict failures - that's the job of AnomalyPredictor.
"""

from typing import Dict, List, Any, Optional
import pandas as pd
import numpy as np
from datetime import datetime

from ..core.model_interface import BaseModel
from ..core.types import TimeSeriesConfig, TaskType, AlgorithmType
from ..algorithms.factory import AlgorithmRegistry


class ForecastModel(BaseModel):
    """
    Forecasts future sensor telemetry values using time series algorithms.

    This model ONLY forecasts sensor readings - it does NOT predict failures.
    Use AnomalyPredictor for failure prediction.
    """

    def __init__(
        self,
        name: str = "forecast_model",
        algorithm_name: str = "prophet",
        algorithm_hyperparams: Optional[Dict[str, Any]] = None,
        data_registry=None,
    ):
        """
        Initialize the forecast model.

        Args:
            name: Model name
            algorithm_name: Which time series algorithm to use (prophet, xgboost_ts)
            algorithm_hyperparams: Hyperparameters for the algorithm
            data_registry: DataRegistry instance for database access
        """
        super().__init__(name, data_registry=data_registry)
        self.algorithm_name = algorithm_name
        self.algorithm_hyperparams = algorithm_hyperparams or {}
        self.sensor_name: Optional[str] = None

        # Create time series algorithm
        config = TimeSeriesConfig(
            name=algorithm_name,
            algorithm_type=AlgorithmType.TIME_SERIES,
            task_type=TaskType.TIME_SERIES_FORECAST,
            time_column="timestamp",
            value_column="value",
            hyperparameters=self.algorithm_hyperparams.copy(),
        )

        algorithm = AlgorithmRegistry.create(config)
        self.add_algorithm("forecast", algorithm)

    def fetch(self, device_id: str, **kwargs) -> pd.DataFrame:
        """
        Fetch training data for forecasting from database.

        Args:
            device_id: Device or model identifier
            **kwargs: Additional parameters (sensor_key, days_back, etc.)

        Returns:
            DataFrame with 'ds' and 'y' columns (Prophet format)
        """
        from datetime import datetime, timedelta
        import logging

        logger = logging.getLogger(__name__)
        sensor_key = kwargs.get("sensor_key", "sensor_00")
        days_back = kwargs.get("days_back", 90)

        # Use registry if available
        if self.data_registry:
            try:
                logger.info(
                    f"Fetching forecast data via registry for device {device_id}, sensor {sensor_key}"
                )

                forecast_data = self.data_registry.fetch_forecast_training_data(
                    device_id=device_id, sensor_key=sensor_key, days_back=days_back
                )

                if forecast_data.empty:
                    logger.warning(
                        f"No forecast data available, using synthetic data as fallback"
                    )
                    return self._generate_sample_data(n_days=90)

                return forecast_data

            except Exception as e:
                logger.error(f"Error fetching forecast data: {e}")
                logger.warning("Falling back to synthetic data")
                return self._generate_sample_data(n_days=90)
        else:
            # Fallback to old method if no registry
            logger.warning("No data registry provided, using legacy fetch method")
            from src.db_connector import create_training_dataset_for_forecast

            try:
                logger.info(
                    f"Fetching forecast data for device {device_id}, sensor {sensor_key}"
                )

                # Fetch forecast dataset from ThingsBoard (READ-ONLY)
                forecast_data = create_training_dataset_for_forecast(
                    device_id=device_id, sensor_key=sensor_key, days_back=days_back
                )

                if forecast_data.empty:
                    logger.warning(
                        f"No forecast data available, using synthetic data as fallback"
                    )
                    return self._generate_sample_data(n_days=90)

                return forecast_data

            except Exception as e:
                logger.error(f"Error fetching forecast data: {e}")
                logger.warning("Falling back to synthetic data")
                return self._generate_sample_data(n_days=90)

    def _generate_sample_data(self, n_days=90) -> pd.DataFrame:
        """
        FALLBACK: Generate synthetic time series when real data is unavailable.
        """
        from datetime import datetime, timedelta

        start_date = datetime.now() - timedelta(days=n_days)
        timestamps = pd.date_range(start=start_date, periods=n_days * 24, freq="H")

        t = np.arange(len(timestamps))
        trend = 0.01 * t
        daily_season = 10 * np.sin(2 * np.pi * t / 24)
        weekly_season = 5 * np.sin(2 * np.pi * t / (24 * 7))
        noise = np.random.normal(0, 2, len(timestamps))
        values = 50 + trend + daily_season + weekly_season + noise

        return pd.DataFrame({"ds": timestamps, "y": values})

    def train(
        self,
        data: pd.DataFrame,
        sensor_name: str,
        time_column: str = "timestamp",
        value_column: str = "value",
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Train the forecast model on historical sensor data.

        Args:
            data: DataFrame with timestamp and sensor value columns
            sensor_name: Name of the sensor being forecasted
            time_column: Name of timestamp column
            value_column: Name of value column
            **kwargs: Additional training parameters

        Returns:
            Dictionary with training results
        """
        if time_column not in data.columns or value_column not in data.columns:
            raise ValueError(
                f"Data must contain '{time_column}' and '{value_column}' columns"
            )

        self.sensor_name = sensor_name
        training_start = datetime.now()

        # Get algorithm
        algorithm = self.get_algorithm("forecast")

        # Update config with actual column names
        algorithm.config.time_column = time_column
        algorithm.config.value_column = value_column

        # Train algorithm
        metrics = algorithm.train(data)

        self.is_trained = True
        self.last_updated = datetime.now()

        return {
            "sensor_name": sensor_name,
            "algorithm": self.algorithm_name,
            "mae": metrics.mae,
            "rmse": metrics.rmse,
            "r2_score": metrics.r2_score,
            "training_time": metrics.training_time,
            "total_training_time": (datetime.now() - training_start).total_seconds(),
            "n_samples": len(data),
        }

    def predict(
        self, data: pd.DataFrame, time_column: str = "timestamp", **kwargs
    ) -> Dict[str, Any]:
        """
        Make predictions on specific timestamps.

        Args:
            data: DataFrame with timestamps to predict
            time_column: Name of timestamp column
            **kwargs: Additional parameters

        Returns:
            Dictionary with forecasted values
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        if time_column not in data.columns:
            raise ValueError(f"Data must contain '{time_column}' column")

        # Get algorithm
        algorithm = self.get_algorithm("forecast")
        algorithm.config.time_column = time_column

        # Make predictions
        output = algorithm.predict(data)

        return {
            "sensor_name": self.sensor_name,
            "timestamps": data[time_column].tolist(),
            "forecasted_values": output.predictions.tolist(),
            "algorithm": self.algorithm_name,
            "n_samples": len(data),
            "prediction_time": output.prediction_time.isoformat(),
        }

    def forecast(self, periods: int, freq: str = "H", **kwargs) -> Dict[str, Any]:
        """
        Forecast future sensor values.

        Args:
            periods: Number of time periods to forecast
            freq: Frequency of forecasts ('H' for hourly, 'D' for daily, etc.)
            **kwargs: Additional parameters

        Returns:
            Dictionary with forecast results
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before forecasting")

        # Get algorithm
        algorithm = self.get_algorithm("forecast")

        # Make forecast
        forecast_output = algorithm.forecast(periods, freq, **kwargs)

        result = {
            "sensor_name": self.sensor_name,
            "timestamps": [
                ts.isoformat() if isinstance(ts, datetime) else str(ts)
                for ts in forecast_output.timestamps
            ],
            "forecasted_values": forecast_output.forecasted_values.tolist(),
            "algorithm": self.algorithm_name,
            "freq": freq,
            "periods": periods,
            "forecast_time": forecast_output.forecast_time.isoformat(),
        }

        # Add confidence intervals if available
        if forecast_output.lower_bound is not None:
            result["lower_bound"] = forecast_output.lower_bound.tolist()
        if forecast_output.upper_bound is not None:
            result["upper_bound"] = forecast_output.upper_bound.tolist()
            result["confidence_level"] = forecast_output.confidence_level

        return result

    def forecast_multiple_horizons(
        self, horizons: List[int], freq: str = "H", **kwargs
    ) -> Dict[str, Any]:
        """
        Forecast at multiple time horizons.

        Args:
            horizons: List of forecast horizons (e.g., [1, 6, 12, 24])
            freq: Frequency of forecasts
            **kwargs: Additional parameters

        Returns:
            Dictionary with forecasts for each horizon
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before forecasting")

        results = {}

        for horizon in horizons:
            forecast_result = self.forecast(horizon, freq, **kwargs)
            results[f"horizon_{horizon}"] = forecast_result

        return {
            "sensor_name": self.sensor_name,
            "algorithm": self.algorithm_name,
            "horizons": horizons,
            "forecasts": results,
            "forecast_time": datetime.now().isoformat(),
        }

    def get_model_info(self) -> Dict[str, Any]:
        """
        Get detailed information about the forecast model.

        Returns:
            Dictionary with model details
        """
        info = self.get_info()
        info["sensor_name"] = self.sensor_name
        info["algorithm_name"] = self.algorithm_name

        # Add training metrics if available
        algorithm = self.get_algorithm("forecast")
        if algorithm.training_metrics:
            info["training_metrics"] = {
                "mae": algorithm.training_metrics.mae,
                "rmse": algorithm.training_metrics.rmse,
                "r2_score": algorithm.training_metrics.r2_score,
            }

        return info
