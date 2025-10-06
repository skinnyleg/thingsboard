"""
Example: Using AlgorithmRegistry directly to create and compare algorithms.

This example demonstrates the factory pattern and algorithm comparison.
"""

import sys
from pathlib import Path

# Add library to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from library.core.types import SupervisedConfig, TaskType, AlgorithmType
from library.algorithms import AlgorithmRegistry
import pandas as pd
import numpy as np
from datetime import datetime


def generate_classification_data(n_samples=1000):
    """Generate sample classification dataset"""
    np.random.seed(42)

    # Generate features
    X = pd.DataFrame(
        {
            "temperature": np.random.normal(70, 15, n_samples),
            "pressure": np.random.normal(100, 20, n_samples),
            "vibration": np.random.normal(50, 10, n_samples),
            "humidity": np.random.normal(60, 15, n_samples),
        }
    )

    # Generate target (failure if temp > 85 OR pressure > 120 OR vibration > 60)
    y = (
        (X["temperature"] > 85) | (X["pressure"] > 120) | (X["vibration"] > 60)
    ).astype(int)

    return X, pd.Series(y, name="failure")


def main():
    print("=" * 80)
    print("AlgorithmRegistry Example - Algorithm Comparison")
    print("=" * 80)
    print()

    # 1. List Available Algorithms
    print("1. Listing available algorithms...")
    available = AlgorithmRegistry.list_algorithms()
    print(f"   Available algorithms: {', '.join(available)}")
    print()

    # 2. Generate Data
    print("2. Generating sample classification data...")
    X, y = generate_classification_data(n_samples=1000)
    print(f"   Generated {len(X)} samples with {X.shape[1]} features")
    print(f"   Positive class rate: {y.mean():.1%}")
    print()

    # 3. Create and Compare Multiple Algorithms
    algorithms_to_test = ["random_forest", "xgboost", "lightgbm", "logistic_regression"]

    print(f"3. Creating and training {len(algorithms_to_test)} algorithms...")
    results = {}

    for algo_name in algorithms_to_test:
        print(f"\n   Testing {algo_name}...")

        # Create configuration
        config = SupervisedConfig(
            name=algo_name,
            algorithm_type=AlgorithmType.SUPERVISED,
            task_type=TaskType.BINARY_CLASSIFICATION,
            feature_columns=X.columns.tolist(),
            target_column="failure",
            test_size=0.2,
            cv_folds=5,
            hyperparameters={
                "n_estimators": (
                    50
                    if algo_name in ["random_forest", "xgboost", "lightgbm"]
                    else None
                ),
                "max_depth": (
                    5 if algo_name in ["random_forest", "xgboost", "lightgbm"] else None
                ),
            },
        )

        # Remove None values from hyperparameters
        config.hyperparameters = {
            k: v for k, v in config.hyperparameters.items() if v is not None
        }

        # Create algorithm
        start_time = datetime.now()
        algorithm = AlgorithmRegistry.create(config)

        # Check capabilities
        caps = algorithm.capabilities
        print(f"     Capabilities:")
        print(f"       - Supports classification: {caps.supports_classification}")
        print(
            f"       - Supports feature importance: {caps.supports_feature_importance}"
        )
        print(f"       - Supports probability: {caps.supports_probability}")
        print(f"       - Handles missing values: {caps.handles_missing_values}")

        # Train
        metrics = algorithm.train(X, y)
        train_time = (datetime.now() - start_time).total_seconds()

        print(f"     Training completed in {train_time:.2f}s")
        print(f"     Accuracy: {metrics.accuracy:.3f}")
        print(f"     Precision: {metrics.precision:.3f}")
        print(f"     Recall: {metrics.recall:.3f}")
        print(f"     F1 Score: {metrics.f1_score:.3f}")
        print(f"     ROC AUC: {metrics.roc_auc:.3f}")
        print(
            f"     Cross-val mean: {np.mean(metrics.cross_val_scores):.3f} (±{np.std(metrics.cross_val_scores):.3f})"
        )

        # Store results
        results[algo_name] = {
            "algorithm": algorithm,
            "metrics": metrics,
            "train_time": train_time,
        }

        # Feature importance
        if caps.supports_feature_importance:
            importance = algorithm.get_feature_importance()
            if importance:
                top_feature = max(importance.items(), key=lambda x: x[1])
                print(
                    f"     Most important feature: {top_feature[0]} ({top_feature[1]:.3f})"
                )

    print()

    # 4. Compare Results
    print("4. Comparison Summary:")
    print()
    print(
        f"   {'Algorithm':<20} {'Accuracy':>10} {'F1 Score':>10} {'ROC AUC':>10} {'Train Time':>12}"
    )
    print(f"   {'-'*20} {'-'*10} {'-'*10} {'-'*10} {'-'*12}")

    for algo_name, result in results.items():
        m = result["metrics"]
        t = result["train_time"]
        print(
            f"   {algo_name:<20} {m.accuracy:>10.3f} {m.f1_score:>10.3f} {m.roc_auc:>10.3f} {t:>11.2f}s"
        )

    print()

    # 5. Find Best Algorithm
    print("5. Best performing algorithm:")
    best_algo = max(results.items(), key=lambda x: x[1]["metrics"].f1_score)
    print(f"   {best_algo[0]} with F1 Score: {best_algo[1]['metrics'].f1_score:.3f}")
    print()

    # 6. Make Predictions with Best Algorithm
    print("6. Making predictions with best algorithm...")
    best_algorithm = best_algo[1]["algorithm"]

    # Generate new test data
    X_new, _ = generate_classification_data(n_samples=10)

    predictions = best_algorithm.predict(X_new)

    print(f"   Predictions for {len(X_new)} new samples:")
    for i in range(len(X_new)):
        pred = predictions.predictions[i]
        prob = (
            predictions.probabilities[i, 1]
            if predictions.probabilities is not None
            else None
        )

        status = "FAILURE" if pred == 1 else "NORMAL"
        prob_str = f" (prob: {prob:.2%})" if prob is not None else ""
        print(f"     Sample {i}: {status}{prob_str}")

    print()

    # 7. Save Best Model
    print("7. Saving best algorithm...")
    model_path = Path(__file__).parent / "saved_models" / f"best_{best_algo[0]}.pkl"
    model_path.parent.mkdir(parents=True, exist_ok=True)
    best_algorithm.save(model_path)
    print(f"   Model saved to: {model_path}")
    print()

    print("=" * 80)
    print("Example completed successfully!")
    print("=" * 80)


if __name__ == "__main__":
    main()
