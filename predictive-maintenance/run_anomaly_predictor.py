#!/usr/bin/env python3
"""
Standalone runner for anomaly_predictor.py
Run this from the predictive-maintenance directory or anywhere with:
    python run_anomaly_predictor.py
"""

import sys
from pathlib import Path

# Add the predictive-maintenance directory to Python path
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))

# Now import and run the module
from library.models.anomaly_predictor import *

if __name__ == "__main__":
    # Load data - find the thingsboard root directory
    # The application directory is a sibling to predictive-maintenance
    # Go up from project_root to find thingsboard root
    current = project_root
    base_path = None

    # Try current directory and up to 3 levels up
    for _ in range(4):
        test_path = current / "application/src/main/resources/predictive-maintenance/data"
        if test_path.exists():
            base_path = test_path
            break
        current = current.parent

    if base_path is None:
        # Try alternative: maybe we're already in thingsboard root
        raise FileNotFoundError(
            f"Could not find data directory.\n"
            f"Searched from: {project_root}\n"
            f"Last tried: {current / 'application/src/main/resources/predictive-maintenance/data'}\n"
            f"Make sure you're running from within the thingsboard project."
        )

    telemetry = pd.read_csv(base_path / "PdM_telemetry.csv")
    errors = pd.read_csv(base_path / "PdM_errors.csv")
    maint = pd.read_csv(base_path / "PdM_maint.csv")
    failures = pd.read_csv(base_path / "PdM_failures.csv")
    machines = pd.read_csv(base_path / "PdM_machines.csv")

    cutoff = pd.to_datetime("2015-01-01 06:00:00")

    telemetry["datetime"] = pd.to_datetime(telemetry["datetime"], errors="coerce")
    telemetry = telemetry.loc[telemetry["datetime"] > cutoff].reset_index(drop=True)

    errors["datetime"] = pd.to_datetime(errors["datetime"], errors="coerce")
    errors = errors.loc[errors["datetime"] > cutoff].reset_index(drop=True)

    maint["datetime"] = pd.to_datetime(maint["datetime"], errors="coerce")
    maint = maint.loc[maint["datetime"] > cutoff].reset_index(drop=True)

    failures["datetime"] = pd.to_datetime(failures["datetime"], errors="coerce")
    failures = failures.loc[failures["datetime"] > cutoff].reset_index(drop=True)

    end_date = pd.to_datetime("2015-04-20 02:00:00")

    telemetry = telemetry[telemetry["machineID"] == 1]
    telemetry = telemetry[telemetry["datetime"] <= end_date]
    print("telemetry DataFrame:", telemetry.shape, flush=True)
    print(telemetry.head(), flush=True)

    errors = errors[errors["machineID"] == 1]
    errors = errors[errors["datetime"] <= end_date]
    print("errors DataFrame:", errors.shape, flush=True)
    print(errors.head(), flush=True)

    maint = maint[maint["machineID"] == 1]
    maint = maint[maint["datetime"] <= end_date]
    print("maint DataFrame:", maint.shape, flush=True)
    print(maint.head(), flush=True)

    failures = failures[failures["machineID"] == 1]
    failures = failures[failures["datetime"] <= end_date]
    print("failures DataFrame:", failures.shape, flush=True)
    print(failures.head(), flush=True)

    machines = machines[machines["machineID"] == 1]

    # Train the model
    components = ["comp1", "comp2", "comp3", "comp4"]
    error_classes = ["error1", "error2", "error3", "error4", "error5"]
    hourly_models, feature_cols, labeled_features_clean = train_model(
        telemetry, errors, maint, failures, machines, components, error_classes, algorithm="xgboost"
    )

    print("\nlabeled_features_clean info:", flush=True)
    print(f"Shape: {labeled_features_clean.shape}", flush=True)
    print(f"Age column: {labeled_features_clean['age'].describe()}", flush=True)

    # Predict failure
    sample_datetime = "2015-04-20 02:00:00"
    sample_telemetry = {"volt": 158, "rotate": 429, "pressure": 94, "vibration": 58}

    result1 = predict_failure(
        sample_telemetry,
        telemetry,
        errors,
        maint,
        failures,
        machines,
        feature_cols,
        hourly_models,
        components,
        error_classes,
    )

    print(f"\nPredictions for Machine 1 starting at {sample_datetime}:")
    for hour in range(1, 25):
        hour_data = result1["hourly_predictions"][f"hour_{hour}"]
        print(f"\nHour {hour} ({hour_data['datetime']}):")
        print(f"  General failure probability: {hour_data['general_failure_probability']:.2%}")
        print(f"  Failure predicted: {hour_data['failure_predicted']}")
        print(f"  Most likely failing component: {hour_data['predicted_failing_component']}")

        if hour_data["component_failure_probabilities"]:
            print(f"  Component failure probabilities:")
            for comp, prob in hour_data["component_failure_probabilities"].items():
                print(f"    {comp}: {prob:.2%}")
