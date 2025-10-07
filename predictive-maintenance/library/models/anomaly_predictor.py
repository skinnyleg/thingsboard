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
        # TODO: Allow configuring days_back later
        # days_back = kwargs.get("days_back", 5000)
        days_back = 240

        # Use registry if available
        if not self.data_registry:
            logger.error("No data registry available, using synthetic data")
            return self._generate_sample_data(n_samples=1000)
        try:
            logger.info(f"Fetching training data via registry for device {device_id}")

            features_df, labels = self.data_registry.fetch_anomaly_training_data(
                device_id=device_id, days_back=days_back, include_failures=True
            )

            if features_df.empty:
                raise ValueError(
                    f"No training data available for device {device_id}. "
                    "Ensure the device has telemetry data (pressure, voltage, rotation, vibration) "
                    "for at least 24 hours."
                )

            # Combine features and labels
            if labels is None or len(labels) == 0:
                raise ValueError(
                    f"No failure history found for device {device_id}. "
                    "Cannot train model without labeled failure data. "
                    "Please add failure records to the device_failures table with root_cause values."
                )

            training_data = features_df.copy()
            training_data["failure_component"] = labels

            # Filter out 'none' samples - only train on actual component failures
            failure_mask = training_data["failure_component"] != 'none'
            training_data_filtered = training_data[failure_mask]

            if len(training_data_filtered) == 0:
                raise ValueError(
                    f"No actual component failures found for device {device_id}. "
                    "All failure records have root_cause='none' or NULL. "
                    "Need at least some failures with root_cause in ['comp1', 'comp2', 'comp3', 'comp4']."
                )

            print(f"[FETCH] Filtered training data: {len(training_data)} -> {len(training_data_filtered)} samples (excluded 'none')", flush=True)
            print(f"[FETCH] Component distribution: {training_data_filtered['failure_component'].value_counts().to_dict()}", flush=True)

            return training_data_filtered

        except ValueError as ve:
            # Re-raise ValueError to be caught by caller
            raise ve
        except Exception as e:
            logger.error(f"Error fetching training data: {e}")
            raise RuntimeError(f"Failed to fetch training data: {str(e)}")

    def fetch_latest(self, device_id, **kwargs):
        # Fetch features WITHOUT failure labels for prediction
        if not self.data_registry:
            raise ValueError("No data registry available")

        features_df, _ = self.data_registry.fetch_anomaly_training_data(
            device_id=device_id, days_back=30, include_failures=False
        )

        if features_df.empty:
            raise ValueError(f"No data available for device {device_id}")

        # Get the latest row
        latest_data = features_df.tail(1)
        latest_data = latest_data.fillna(0)

        # Ensure failure_component column doesn't exist in prediction data
        if 'failure_component' in latest_data.columns:
            latest_data = latest_data.drop('failure_component', axis=1)

        return latest_data

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

        # Multi-class target: 'none', 'comp1', 'comp2', 'comp3', 'comp4'
        failure_component = np.full(n_samples, 'none', dtype=object)
        failure_indices = sensor_avg > 90

        # Assign random components to failures
        component_labels = ['comp1', 'comp2', 'comp3', 'comp4']
        failure_component[failure_indices] = np.random.choice(
            component_labels, size=np.sum(failure_indices)
        )

        data["failure_component"] = failure_component

        return pd.DataFrame(data)

    def train(self, data: pd.DataFrame, **kwargs) -> Dict[str, Any]:
        """
        Train the model on historical machine data.

        Args:
            data: DataFrame with engineered features and 'failure_component' target
            **kwargs: Additional training parameters

        Returns:
            Dictionary with training results
        """
        if "failure_component" not in data.columns:
            raise ValueError("Data must contain 'failure_component' target column")

        # Extract feature columns dynamically (all columns except target)
        self.feature_columns = [
            col for col in data.columns if col != "failure_component"
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
                task_type=TaskType.MULTICLASS_CLASSIFICATION,
                feature_columns=self.feature_columns,
                target_column="failure_component",
                hyperparameters=self.algorithm_hyperparams.copy(),
            )

            self.algorithm = AlgorithmRegistry.create(config)
            self.add_algorithm("main", self.algorithm)

        results = {}
        training_start = datetime.now()

        # Prepare data
        X = data[self.feature_columns]
        y_raw = data["failure_component"]

        # Encode string labels to integers for XGBoost
        from sklearn.preprocessing import LabelEncoder
        self.label_encoder = LabelEncoder()
        y = self.label_encoder.fit_transform(y_raw)

        # Store class mapping for later use
        self.class_labels = self.label_encoder.classes_
        logger.info(f"Class mapping: {dict(enumerate(self.class_labels))}")
        print(f"[TRAIN] Class mapping: {dict(enumerate(self.class_labels))}", flush=True)

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
        Predict which component will fail within 24 hours (multi-class).

        Args:
            data: DataFrame with engineered features
            threshold: Probability threshold for classification (not used in multi-class)
            **kwargs: Additional parameters

        Returns:
            Dictionary with predictions and component probabilities
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

        predictions_encoded = output.predictions  # Integer predictions
        probabilities = output.probabilities  # Shape: (n_samples, n_classes)

        # Decode integer predictions back to string labels
        if hasattr(self, 'label_encoder') and hasattr(self, 'class_labels'):
            predictions = self.label_encoder.inverse_transform(predictions_encoded)
            classes = self.class_labels
        else:
            # Fallback if model was trained without label encoder
            predictions = predictions_encoded
            classes = ['none', 'comp1', 'comp2', 'comp3', 'comp4']

        # Build component probabilities for each sample
        component_probs_list = []
        for i in range(len(predictions)):
            sample_probs = {}
            for j, cls in enumerate(classes):
                sample_probs[str(cls)] = float(probabilities[i, j])
            component_probs_list.append(sample_probs)

        # Calculate failure probability (1 - P(none))
        failure_probs = []
        for probs in component_probs_list:
            failure_prob = 1.0 - probs.get('none', 0.0)
            failure_probs.append(failure_prob)

        return {
            "predicted_components": [str(p) for p in predictions],
            "component_probabilities": component_probs_list,
            "failure_probabilities": failure_probs,
            "n_samples": len(data),
            "features_used": self.feature_columns,
            "prediction_time": datetime.now().isoformat(),
            "classes": [str(c) for c in classes],
        }

    def predict_single_machine(
        self, feature_dict: Dict[str, float], threshold: float = 0.5
    ) -> Dict[str, Any]:
        """
        Predict which component will fail for a single machine.

        Args:
            feature_dict: Dictionary mapping feature names to values
            threshold: Probability threshold (not used in multi-class)

        Returns:
            Dictionary with prediction result including component probabilities
        """
        # Convert to DataFrame
        data = pd.DataFrame([feature_dict])

        # Make prediction
        result = self.predict(data, threshold)

        # Return single result
        return {
            "predicted_component": result["predicted_components"][0],
            "component_probabilities": result["component_probabilities"][0],
            "failure_probability": result["failure_probabilities"][0],
            "will_fail": result["predicted_components"][0] != 'none',
            "features_used": result["features_used"],
            "prediction_time": result["prediction_time"],
            "classes": result["classes"],
        }

    def save(self, path):
        """
        Save the trained model to disk.

        Overrides base class to also save label_encoder for multi-class classification.

        Args:
            path: Directory path where to save the model
        """
        from pathlib import Path
        import joblib

        # Call parent save method
        super().save(path)

        # Additionally save label_encoder and class_labels if they exist
        path = Path(path)
        if hasattr(self, 'label_encoder') and hasattr(self, 'class_labels'):
            joblib.dump({
                'label_encoder': self.label_encoder,
                'class_labels': self.class_labels
            }, path / "label_encoder.pkl")
            print(f"[SAVE] Saved label encoder with classes: {self.class_labels}", flush=True)

    def load(self, path):
        """
        Load the trained model from disk.

        Overrides the base class method to properly restore the algorithm reference.

        Args:
            path: Directory path where the model is saved
        """
        from pathlib import Path
        from ..algorithms.factory import AlgorithmRegistry
        from ..core.types import SupervisedConfig, TaskType, AlgorithmType
        import joblib

        path = Path(path)

        # Load metadata first
        metadata = joblib.load(path / "metadata.pkl")
        self.name = metadata["name"]
        self.is_trained = metadata["is_trained"]
        self.created_at = metadata["created_at"]
        self.last_updated = metadata.get("last_updated")

        # Load the algorithm if it exists
        if "main" in metadata["algorithm_keys"]:
            algorithm_path = path / "algorithm_main.pkl"

            # Load the algorithm data to get the config
            algorithm_data = joblib.load(algorithm_path)
            loaded_config = algorithm_data["config"]

            # Create a new algorithm instance with the loaded config
            self.algorithm = AlgorithmRegistry.create(loaded_config)

            # Now load the trained model into the algorithm
            self.algorithm.load(algorithm_path)

            # Add to algorithms dict
            self.add_algorithm("main", self.algorithm)

            # Restore feature columns from the config
            self.feature_columns = loaded_config.feature_columns
        else:
            raise ValueError("Algorithm 'main' not found in loaded model")

        # Load label_encoder if it exists
        label_encoder_path = path / "label_encoder.pkl"
        if label_encoder_path.exists():
            encoder_data = joblib.load(label_encoder_path)
            self.label_encoder = encoder_data['label_encoder']
            self.class_labels = encoder_data['class_labels']
            print(f"[LOAD] Loaded label encoder with classes: {self.class_labels}", flush=True)
        else:
            print(f"[LOAD] No label encoder found, using default classes", flush=True)
