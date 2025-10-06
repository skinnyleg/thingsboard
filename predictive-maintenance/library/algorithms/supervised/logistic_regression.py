"""
Logistic Regression algorithm adapter.
"""

from typing import Optional
import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression as SKLogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
)
import time

from ...core.algorithm_interface import BaseAlgorithm
from ...core.types import (
    SupervisedConfig,
    PredictionOutput,
    TrainingMetrics,
    AlgorithmCapabilities,
    TaskType,
)


class LogisticRegressionAdapter(BaseAlgorithm):
    """Adapter for scikit-learn Logistic Regression algorithm"""

    def __init__(self, config: SupervisedConfig):
        super().__init__(config)
        self.config: SupervisedConfig = config
        self.scaler = StandardScaler()

    def _define_capabilities(self) -> AlgorithmCapabilities:
        return AlgorithmCapabilities(
            supports_classification=True,
            supports_regression=False,
            supports_time_series=False,
            supports_feature_importance=True,
            supports_probability=True,
            supports_incremental_learning=False,
            requires_scaling=True,
            handles_missing_values=False,
            handles_categorical=False,
        )

    def train(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> TrainingMetrics:
        """Train Logistic Regression model"""
        if y is None:
            raise ValueError("Logistic Regression requires target variable y")

        if self.config.task_type == TaskType.REGRESSION:
            raise ValueError("Logistic Regression only supports classification tasks")

        start_time = time.time()

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=self.config.test_size, random_state=self.config.random_state
        )

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # Create model
        self.model = SKLogisticRegression(
            random_state=self.config.random_state,
            max_iter=1000,
            **self.config.hyperparameters,
        )

        # Train model
        self.model.fit(X_train_scaled, y_train)
        self.is_trained = True

        # Make predictions
        y_pred = self.model.predict(X_test_scaled)

        # Calculate metrics
        metrics = TrainingMetrics(training_time=time.time() - start_time)

        metrics.accuracy = float(accuracy_score(y_test, y_pred))
        metrics.precision = float(
            precision_score(
                y_test,
                y_pred,
                average="binary" if len(np.unique(y)) == 2 else "weighted",
            )
        )
        metrics.recall = float(
            recall_score(
                y_test,
                y_pred,
                average="binary" if len(np.unique(y)) == 2 else "weighted",
            )
        )
        metrics.f1_score = float(
            f1_score(
                y_test,
                y_pred,
                average="binary" if len(np.unique(y)) == 2 else "weighted",
            )
        )
        metrics.confusion_matrix = confusion_matrix(y_test, y_pred)

        # ROC AUC for binary classification
        if len(np.unique(y)) == 2:
            y_prob = self.model.predict_proba(X_test_scaled)[:, 1]
            metrics.roc_auc = float(roc_auc_score(y_test, y_prob))

        # Cross-validation scores
        cv_scores = cross_val_score(
            self.model,
            X_train_scaled,
            y_train,
            cv=self.config.cv_folds,
            scoring="accuracy",
        )
        metrics.cross_val_scores = cv_scores.tolist()

        # Feature importance (coefficients)
        if hasattr(self.model, "coef_"):
            feature_names = (
                X.columns.tolist()
                if hasattr(X, "columns")
                else [f"feature_{i}" for i in range(X.shape[1])]
            )
            # Use absolute values of coefficients as importance
            importances = (
                np.abs(self.model.coef_[0])
                if len(self.model.coef_) == 1
                else np.abs(self.model.coef_).mean(axis=0)
            )
            metrics.feature_importances = dict(zip(feature_names, importances.tolist()))

        self.training_metrics = metrics
        return metrics

    def predict(self, X: pd.DataFrame) -> PredictionOutput:
        """Make predictions with Logistic Regression"""
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        # Scale features
        X_scaled = self.scaler.transform(X)

        predictions = self.model.predict(X_scaled)
        probabilities = self.model.predict_proba(X_scaled)

        return PredictionOutput(
            predictions=predictions,
            probabilities=probabilities,
            metadata={"algorithm": "logistic_regression", "n_samples": len(X)},
        )

    def get_feature_importance(self) -> Optional[dict[str, float]]:
        """Get feature importance from trained model"""
        if not self.is_trained:
            return None

        if self.training_metrics and self.training_metrics.feature_importances:
            return self.training_metrics.feature_importances

        return None
