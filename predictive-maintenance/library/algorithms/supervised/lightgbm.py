"""
LightGBM algorithm adapter.
"""

from typing import Optional
import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    mean_squared_error,
    mean_absolute_error,
    r2_score,
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


class LightGBMAdapter(BaseAlgorithm):
    """Adapter for LightGBM algorithm"""

    def __init__(self, config: SupervisedConfig):
        super().__init__(config)
        self.config: SupervisedConfig = config

    def _define_capabilities(self) -> AlgorithmCapabilities:
        return AlgorithmCapabilities(
            supports_classification=True,
            supports_regression=True,
            supports_time_series=False,
            supports_feature_importance=True,
            supports_probability=True,
            supports_incremental_learning=True,
            requires_scaling=False,
            handles_missing_values=True,
            handles_categorical=True,
        )

    def train(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> TrainingMetrics:
        """Train LightGBM model"""
        if y is None:
            raise ValueError("LightGBM requires target variable y")

        start_time = time.time()

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=self.config.test_size, random_state=self.config.random_state
        )

        # Create model based on task type
        if self.config.task_type == TaskType.REGRESSION:
            self.model = lgb.LGBMRegressor(
                random_state=self.config.random_state,
                verbose=-1,
                **self.config.hyperparameters,
            )
        else:
            self.model = lgb.LGBMClassifier(
                random_state=self.config.random_state,
                verbose=-1,
                **self.config.hyperparameters,
            )

        # Train model
        self.model.fit(
            X_train,
            y_train,
            eval_set=[(X_test, y_test)],
            callbacks=[lgb.early_stopping(stopping_rounds=10, verbose=False)],
        )
        self.is_trained = True

        # Make predictions
        y_pred = self.model.predict(X_test)

        # Calculate metrics
        metrics = TrainingMetrics(training_time=time.time() - start_time)

        if self.config.task_type == TaskType.REGRESSION:
            metrics.rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
            metrics.mae = float(mean_absolute_error(y_test, y_pred))
            metrics.r2_score = float(r2_score(y_test, y_pred))
        else:
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
                y_prob = self.model.predict_proba(X_test)[:, 1]
                metrics.roc_auc = float(roc_auc_score(y_test, y_prob))

        # Cross-validation scores
        cv_scores = cross_val_score(
            self.model,
            X_train,
            y_train,
            cv=self.config.cv_folds,
            scoring=(
                "accuracy" if self.config.task_type != TaskType.REGRESSION else "r2"
            ),
        )
        metrics.cross_val_scores = cv_scores.tolist()

        # Feature importance
        if hasattr(self.model, "feature_importances_"):
            feature_names = (
                X.columns.tolist()
                if hasattr(X, "columns")
                else [f"feature_{i}" for i in range(X.shape[1])]
            )
            metrics.feature_importances = dict(
                zip(feature_names, self.model.feature_importances_.tolist())
            )

        self.training_metrics = metrics
        return metrics

    def predict(self, X: pd.DataFrame) -> PredictionOutput:
        """Make predictions with LightGBM"""
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        predictions = self.model.predict(X)
        probabilities = None

        if hasattr(self.model, "predict_proba"):
            probabilities = self.model.predict_proba(X)

        return PredictionOutput(
            predictions=predictions,
            probabilities=probabilities,
            metadata={"algorithm": "lightgbm", "n_samples": len(X)},
        )

    def get_feature_importance(self) -> Optional[dict[str, float]]:
        """Get feature importance from trained model"""
        if not self.is_trained or not hasattr(self.model, "feature_importances_"):
            return None

        if self.training_metrics and self.training_metrics.feature_importances:
            return self.training_metrics.feature_importances

        return None
