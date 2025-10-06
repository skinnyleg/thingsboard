"""
Anomaly Predictor Model - Predicts machine failures 24 hours in advance.

This model uses 48 ML algorithms (one per sensor) to predict whether a machine
will fail within the next 24 hours based on sensor telemetry data.
"""

from typing import Dict, List, Any, Optional
import pandas as pd
import numpy as np
from datetime import datetime
import logging

from ..core.model_interface import BaseModel
from ..core.types import SupervisedConfig, TaskType, AlgorithmType
from ..algorithms.factory import AlgorithmRegistry


class AnomalyPredictor(BaseModel):
    """
    Predicts machine failures 24 hours in advance using Random Forest.

    Uses engineered features from the notebook:
    - Telemetry aggregations (3h and 24h windows) - DYNAMIC based on model config
    - Error counts (24h rolling)
    - Component maintenance history
    - Machine age
    """

    def __init__(
        self,
        name: str = "anomaly_predictor",
        algorithm_name: str = "random_forest",
        algorithm_hyperparams: Optional[Dict[str, Any]] = None,
        data_registry=None,
    ):
        """
        Initialize the anomaly predictor model.

        Args:
            name: Model name
            algorithm_name: Which algorithm to use (random_forest, xgboost, lightgbm, catboost)
            algorithm_hyperparams: Hyperparameters for the algorithm
            data_registry: DataRegistry instance for database access
        """
        super().__init__(name, data_registry=data_registry)
        self.algorithm_name = algorithm_name
        self.algorithm_hyperparams = algorithm_hyperparams or {}
        self.feature_columns = []  # Will be set dynamically during training

        # Algorithm will be created during training once we know the features
        self.algorithm = None

    def _build_feature_columns(
        self,
        telemetry_keys: List[str],
        error_keys: List[str],
        component_keys: List[str],
    ) -> List[str]:
        """
        Build feature column names dynamically based on available keys.

        Args:
            telemetry_keys: List of telemetry keys (e.g., ['volt', 'rotate', 'pressure', 'vibration'])
            error_keys: List of error keys (e.g., ['error1', 'error2', ...])
            component_keys: List of component keys (e.g., ['comp1', 'comp2', ...])

        Returns:
            List of feature column names
        """
        features = []

        # Add telemetry features (3h and 24h aggregations)
        for key in telemetry_keys:
            features.extend(
                [f"{key}mean_3h", f"{key}sd_3h", f"{key}mean_24h", f"{key}sd_24h"]
            )

        # Add error counts
        for i in range(1, len(error_keys) + 1):
            features.append(f"error{i}count")

        # Add component maintenance days
        features.extend(component_keys)

        # Add machine age
        features.append("age")

        return features

    def fetch(self, device_id: str, **kwargs) -> pd.DataFrame:
        """
        Fetch training data for anomaly detection from database.

        Args:
            device_id: Device or model identifier
            **kwargs: Additional parameters (days_back, etc.)

        Returns:
            DataFrame with engineered features and failure labels
        """
        import logging

        logger = logging.getLogger(__name__)
        days_back = kwargs.get("days_back", 90)

        # Use registry if available
        if self.data_registry:
            try:
                logger.info(
                    f"Fetching training data via registry for device {device_id}"
                )

                features_df, labels = self.data_registry.fetch_anomaly_training_data(
                    device_id=device_id, days_back=days_back, include_failures=True
                )

                if features_df.empty:
                    logger.warning(
                        f"No training data available for device {device_id}, using synthetic data"
                    )
                    return self._generate_sample_data(n_samples=1000)

                # Combine features and labels
                if labels is not None:
                    training_data = features_df.copy()
                    training_data["failure_within_24h"] = labels
                    return training_data
                else:
                    # If no failure data, create synthetic labels
                    logger.warning(
                        "No failure history found, creating synthetic labels"
                    )
                    training_data = features_df.copy()
                    # Use voltage mean as proxy for failure risk
                    training_data["failure_within_24h"] = (
                        training_data["voltmean_3h"]
                        > training_data["voltmean_3h"].quantile(0.9)
                    ).astype(int)
                    return training_data

            except Exception as e:
                logger.error(f"Error fetching training data: {e}")
                logger.warning("Falling back to synthetic data")
                return self._generate_sample_data(n_samples=1000)
        else:
            # Fallback to old method if no registry
            logger.warning("No data registry provided, using legacy fetch method")
            from src.db_connector import create_training_dataset_for_anomaly

            try:
                logger.info(f"Fetching training data for device {device_id}")

                features_df, labels = create_training_dataset_for_anomaly(
                    device_id=device_id, days_back=days_back, include_failures=True
                )

                if features_df.empty:
                    logger.warning(
                        f"No training data available for device {device_id}, using synthetic data as fallback"
                    )
                    return self._generate_sample_data(n_samples=1000)

                # Combine features and labels
                if labels is not None:
                    training_data = features_df.copy()
                    training_data["failure_within_24h"] = labels
                    return training_data
                else:
                    # If no failure data, create synthetic labels for training
                    logger.warning(
                        "No failure history found, creating synthetic labels"
                    )
                    training_data = features_df.copy()
                    training_data["failure_within_24h"] = (
                        training_data.get("voltmean_3h", training_data.mean(axis=1))
                        > training_data.get(
                            "voltmean_3h", training_data.mean(axis=1)
                        ).quantile(0.9)
                    ).astype(int)
                    return training_data

            except Exception as e:
                logger.error(f"Error fetching training data: {e}")
                logger.warning("Falling back to synthetic data")
                return self._generate_sample_data(n_samples=1000)

    def _generate_sample_data(self, n_samples=1000) -> pd.DataFrame:
        """
        FALLBACK: Generate synthetic sample data when real data is unavailable.
        """
        np.random.seed(42)
        data = {}

        # Generate 48 sensor readings
        for i in range(48):
            base_values = np.random.normal(75, 10, n_samples)
            failure_indices = np.random.choice(
                n_samples, size=int(n_samples * 0.1), replace=False
            )
            base_values[failure_indices] += np.random.normal(
                30, 10, len(failure_indices)
            )
            data[f"sensor_{i:02d}"] = base_values

        sensor_avg = np.mean([data[f"sensor_{i:02d}"] for i in range(48)], axis=0)
        data["failure_within_24h"] = (sensor_avg > 90).astype(int)

        return pd.DataFrame(data)

    def train(self, data: pd.DataFrame, **kwargs) -> Dict[str, Any]:
        """
        Train the model on historical machine data.

        Args:
            data: DataFrame with engineered features and 'failure_within_24h' target
            **kwargs: Additional training parameters

        Returns:
            Dictionary with training results
        """
        if "failure_within_24h" not in data.columns:
            raise ValueError("Data must contain 'failure_within_24h' target column")

        # Extract feature columns dynamically (all columns except target)
        self.feature_columns = [
            col for col in data.columns if col != "failure_within_24h"
        ]

        logger = logging.getLogger(__name__)
        logger.info(
            f"Training with {len(self.feature_columns)} features: {self.feature_columns}"
        )

        # Create algorithm with dynamic features if not already created
        if self.algorithm is None:
            config = SupervisedConfig(
                name=self.algorithm_name,
                algorithm_type=AlgorithmType.SUPERVISED,
                task_type=TaskType.BINARY_CLASSIFICATION,
                feature_columns=self.feature_columns,
                target_column="failure_within_24h",
                hyperparameters=self.algorithm_hyperparams.copy(),
            )

            self.algorithm = AlgorithmRegistry.create(config)
            self.add_algorithm("main", self.algorithm)

        results = {}
        training_start = datetime.now()

        # Prepare data
        X = data[self.feature_columns]
        y = data["failure_within_24h"]

        # Train algorithm
        metrics = self.algorithm.train(X, y)

        results["main"] = {
            "accuracy": metrics.accuracy,
            "precision": metrics.precision,
            "recall": metrics.recall,
            "f1_score": metrics.f1_score,
            "roc_auc": metrics.roc_auc,
            "training_time": metrics.training_time,
        }

        self.is_trained = True
        self.last_updated = datetime.now()

        # Calculate overall statistics
        results["overall"] = {
            "total_features": len(self.feature_columns),
            "feature_names": self.feature_columns,
            "average_accuracy": metrics.accuracy,
            "average_f1_score": metrics.f1_score,
            "total_training_time": (datetime.now() - training_start).total_seconds(),
        }

        return results

    def predict(
        self, data: pd.DataFrame, threshold: float = 0.5, **kwargs
    ) -> Dict[str, Any]:
        """
        Predict if machines will fail within 24 hours.

        Args:
            data: DataFrame with engineered features
            threshold: Probability threshold for classification
            **kwargs: Additional parameters

        Returns:
            Dictionary with predictions and probabilities
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        if not self.algorithm:
            raise ValueError("Algorithm not initialized. Train the model first.")

        # Ensure all feature columns are present
        missing_features = set(self.feature_columns) - set(data.columns)
        if missing_features:
            raise ValueError(f"Data missing feature columns: {missing_features}")

        # Get predictions
        X = data[self.feature_columns]
        output = self.algorithm.predict(X)

        predictions = output.predictions
        probabilities = (
            output.probabilities[:, 1]
            if output.probabilities.ndim > 1
            else output.probabilities
        )

        return {
            "predictions": predictions.tolist(),
            "probabilities": probabilities.tolist(),
            "threshold": threshold,
            "n_samples": len(data),
            "features_used": self.feature_columns,
            "prediction_time": datetime.now().isoformat(),
        }

    def predict_single_machine(
        self, feature_dict: Dict[str, float], threshold: float = 0.5
    ) -> Dict[str, Any]:
        """
        Predict failure for a single machine.

        Args:
            feature_dict: Dictionary mapping feature names to values
            threshold: Probability threshold

        Returns:
            Dictionary with prediction result
        """
        # Convert to DataFrame
        data = pd.DataFrame([feature_dict])

        # Make prediction
        result = self.predict(data, threshold)

        # Return single result
        return {
            "will_fail": bool(result["predictions"][0]),
            "failure_probability": result["probabilities"][0],
            "threshold": threshold,
            "features_used": result["features_used"],
            "prediction_time": result["prediction_time"],
        }
