"""
Example: Train and use AnomalyPredictor for failure prediction.

This example shows how to:
1. Load and prepare data
2. Train the AnomalyPredictor model
3. Make predictions on new data
4. Evaluate sensor importance
"""

import sys
from pathlib import Path

# Add library to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from library import AnomalyPredictor
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


def generate_sample_data(n_samples=1000):
    """
    Generate sample data for demonstration.
    In production, load from database.
    """
    np.random.seed(42)

    data = {}

    # Generate 48 sensor readings
    for i in range(48):
        # Normal operation: values around 50-100
        # Failure mode: values spike or drop
        base_values = np.random.normal(75, 10, n_samples)

        # Add some anomalous patterns
        failure_indices = np.random.choice(
            n_samples, size=int(n_samples * 0.1), replace=False
        )
        base_values[failure_indices] += np.random.normal(30, 10, len(failure_indices))

        data[f"sensor_{i:02d}"] = base_values

    # Create failure target (machines with extreme sensor values will fail)
    sensor_avg = np.mean([data[f"sensor_{i:02d}"] for i in range(48)], axis=0)
    data["failure_within_24h"] = (sensor_avg > 90).astype(int)

    return pd.DataFrame(data)


def main():
    print("=" * 80)
    print("AnomalyPredictor Example - Machine Failure Prediction")
    print("=" * 80)
    print()

    # 1. Generate/Load Data
    print("1. Loading training data...")
    train_data = generate_sample_data(n_samples=1000)
    print(f"   Loaded {len(train_data)} training samples")
    print(f"   Failure rate: {train_data['failure_within_24h'].mean():.1%}")
    print()

    # 2. Initialize Model
    print("2. Initializing AnomalyPredictor with XGBoost...")
    model = AnomalyPredictor(
        name="production_machine_predictor",
        algorithm_name="xgboost",
        algorithm_hyperparams={
            "n_estimators": 50,
            "max_depth": 4,
            "learning_rate": 0.1,
        },
    )
    print(
        f"   Created model with {len(model.list_algorithms())} algorithms (one per sensor)"
    )
    print()

    # 3. Train Model
    print("3. Training model on all sensors...")
    start_time = datetime.now()
    results = model.train(train_data)
    train_time = (datetime.now() - start_time).total_seconds()

    print(f"   Training completed in {train_time:.1f} seconds")
    print(f"   Average Accuracy: {results['overall']['average_accuracy']:.3f}")
    print(f"   Average F1 Score: {results['overall']['average_f1_score']:.3f}")
    print()

    # Show performance of top 5 sensors
    print("   Top 5 sensors by F1 score:")
    sensor_scores = [
        (sensor, metrics["f1_score"])
        for sensor, metrics in results.items()
        if sensor != "overall"
    ]
    sensor_scores.sort(key=lambda x: x[1], reverse=True)
    for sensor, score in sensor_scores[:5]:
        print(f"     {sensor}: {score:.3f}")
    print()

    # 4. Get Sensor Importance
    print("4. Analyzing sensor importance...")
    importance = model.get_sensor_importance()
    top_sensors = sorted(importance.items(), key=lambda x: x[1], reverse=True)[:10]
    print(f"   Top 10 most important sensors:")
    for sensor, score in top_sensors:
        print(f"     {sensor}: {score:.3f}")
    print()

    # 5. Make Predictions
    print("5. Making predictions on test data...")
    test_data = generate_sample_data(n_samples=100)

    # Voting ensemble
    predictions_voting = model.predict(
        test_data.drop(columns=["failure_within_24h"]),
        ensemble_method="voting",
        threshold=0.5,
    )

    # Max probability ensemble
    predictions_max = model.predict(
        test_data.drop(columns=["failure_within_24h"]),
        ensemble_method="max_probability",
        threshold=0.5,
    )

    print(f"   Predictions using 'voting' ensemble:")
    print(f"     Machines predicted to fail: {sum(predictions_voting['predictions'])}")
    print(
        f"     Average failure probability: {np.mean(predictions_voting['probabilities']):.2%}"
    )
    print()

    print(f"   Predictions using 'max_probability' ensemble:")
    print(f"     Machines predicted to fail: {sum(predictions_max['predictions'])}")
    print(
        f"     Average failure probability: {np.mean(predictions_max['probabilities']):.2%}"
    )
    print()

    # 6. Single Machine Prediction
    print("6. Predicting for a single machine...")
    single_reading = {f"sensor_{i:02d}": np.random.normal(75, 10) for i in range(48)}

    single_pred = model.predict_single_machine(
        single_reading, ensemble_method="voting", threshold=0.5
    )

    print(f"   Will fail: {single_pred['will_fail']}")
    print(f"   Failure probability: {single_pred['failure_probability']:.2%}")
    print(f"   Prediction time: {single_pred['prediction_time']}")
    print()

    # 7. Save Model
    print("7. Saving model...")
    model_path = Path(__file__).parent / "saved_models" / "anomaly_predictor"
    model.save(model_path)
    print(f"   Model saved to: {model_path}")
    print()

    # 8. Load Model
    print("8. Loading saved model...")
    loaded_model = AnomalyPredictor(name="loaded_model", algorithm_name="xgboost")
    loaded_model.load(model_path)
    print(f"   Model loaded successfully")
    print(f"   Model info: {loaded_model.get_info()}")
    print()

    print("=" * 80)
    print("Example completed successfully!")
    print("=" * 80)


if __name__ == "__main__":
    main()
