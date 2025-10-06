"""
Example: Train and use ForecastModel for sensor telemetry forecasting.

This example shows how to:
1. Load time series sensor data
2. Train the ForecastModel
3. Make forecasts at different horizons
4. Visualize results (if matplotlib available)
"""

import sys
from pathlib import Path

# Add library to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from library import ForecastModel
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


def generate_time_series_data(n_days=30, freq="H"):
    """
    Generate sample time series data for demonstration.
    In production, load from database.
    """
    # Generate timestamps
    start_date = datetime.now() - timedelta(days=n_days)
    timestamps = pd.date_range(start=start_date, periods=n_days * 24, freq=freq)

    # Generate synthetic sensor values with trend + seasonality + noise
    t = np.arange(len(timestamps))

    # Trend (slight increase over time)
    trend = 0.01 * t

    # Daily seasonality (24-hour cycle)
    daily_season = 10 * np.sin(2 * np.pi * t / 24)

    # Weekly seasonality
    weekly_season = 5 * np.sin(2 * np.pi * t / (24 * 7))

    # Random noise
    noise = np.random.normal(0, 2, len(timestamps))

    # Combine components
    values = 50 + trend + daily_season + weekly_season + noise

    return pd.DataFrame({"timestamp": timestamps, "value": values})


def main():
    print("=" * 80)
    print("ForecastModel Example - Sensor Telemetry Forecasting")
    print("=" * 80)
    print()

    # 1. Generate/Load Data
    print("1. Loading historical sensor data...")
    sensor_data = generate_time_series_data(n_days=30, freq="H")
    print(f"   Loaded {len(sensor_data)} data points")
    print(
        f"   Date range: {sensor_data['timestamp'].min()} to {sensor_data['timestamp'].max()}"
    )
    print(
        f"   Value range: {sensor_data['value'].min():.2f} to {sensor_data['value'].max():.2f}"
    )
    print()

    # 2. Initialize Model with Prophet
    print("2. Initializing ForecastModel with Prophet...")
    model_prophet = ForecastModel(
        name="temperature_forecast_prophet",
        algorithm_name="prophet",
        algorithm_hyperparams={
            "seasonality_mode": "additive",
            "daily_seasonality": True,
            "weekly_seasonality": True,
            "changepoint_prior_scale": 0.05,
        },
    )
    print(f"   Created model with {model_prophet.algorithm_name} algorithm")
    print()

    # 3. Train Model
    print("3. Training Prophet model...")
    start_time = datetime.now()
    results_prophet = model_prophet.train(
        sensor_data,
        sensor_name="temperature_sensor_01",
        time_column="timestamp",
        value_column="value",
    )
    train_time = (datetime.now() - start_time).total_seconds()

    print(f"   Training completed in {train_time:.1f} seconds")
    print(f"   MAE: {results_prophet['mae']:.3f}")
    print(f"   RMSE: {results_prophet['rmse']:.3f}")
    print(f"   R² Score: {results_prophet['r2_score']:.3f}")
    print()

    # 4. Forecast Next 24 Hours
    print("4. Forecasting next 24 hours...")
    forecast_24h = model_prophet.forecast(periods=24, freq="H")

    print(f"   Generated {len(forecast_24h['forecasted_values'])} hourly forecasts")
    print(f"   First 5 forecasts:")
    for i in range(5):
        ts = forecast_24h["timestamps"][i]
        val = forecast_24h["forecasted_values"][i]
        lower = forecast_24h.get("lower_bound", [None])[i]
        upper = forecast_24h.get("upper_bound", [None])[i]

        if lower is not None and upper is not None:
            print(f"     {ts}: {val:.2f} (CI: [{lower:.2f}, {upper:.2f}])")
        else:
            print(f"     {ts}: {val:.2f}")
    print()

    # 5. Multiple Horizon Forecasting
    print("5. Forecasting at multiple horizons (1h, 6h, 12h, 24h)...")
    multi_forecast = model_prophet.forecast_multiple_horizons(
        horizons=[1, 6, 12, 24], freq="H"
    )

    print(f"   Forecasts for different horizons:")
    for horizon_key, forecast in multi_forecast["forecasts"].items():
        horizon = int(horizon_key.split("_")[1])
        last_val = forecast["forecasted_values"][-1]
        print(f"     {horizon}h ahead: {last_val:.2f}")
    print()

    # 6. Initialize XGBoost Time Series Model
    print("6. Training XGBoost time series model for comparison...")
    model_xgb = ForecastModel(
        name="temperature_forecast_xgboost",
        algorithm_name="xgboost_ts",
        algorithm_hyperparams={
            "n_estimators": 100,
            "max_depth": 5,
            "learning_rate": 0.1,
            "n_lags": 24,
        },
    )

    results_xgb = model_xgb.train(
        sensor_data,
        sensor_name="temperature_sensor_01",
        time_column="timestamp",
        value_column="value",
    )

    print(
        f"   XGBoost TS - MAE: {results_xgb['mae']:.3f}, RMSE: {results_xgb['rmse']:.3f}, R²: {results_xgb['r2_score']:.3f}"
    )
    print()

    # 7. Compare Forecasts
    print("7. Comparing Prophet vs XGBoost TS forecasts...")
    forecast_xgb = model_xgb.forecast(periods=24, freq="H")

    print(
        f"   Prophet average forecast: {np.mean(forecast_24h['forecasted_values']):.2f}"
    )
    print(
        f"   XGBoost average forecast: {np.mean(forecast_xgb['forecasted_values']):.2f}"
    )
    print()

    # 8. Model Info
    print("8. Getting model information...")
    info = model_prophet.get_model_info()
    print(f"   Model name: {info['name']}")
    print(f"   Sensor: {info['sensor_name']}")
    print(f"   Is trained: {info['is_trained']}")
    print(f"   Last updated: {info['last_updated']}")
    if "training_metrics" in info:
        print(
            f"   Training metrics: MAE={info['training_metrics']['mae']:.3f}, "
            f"RMSE={info['training_metrics']['rmse']:.3f}"
        )
    print()

    # 9. Save Model
    print("9. Saving Prophet model...")
    model_path = Path(__file__).parent / "saved_models" / "forecast_prophet"
    model_prophet.save(model_path)
    print(f"   Model saved to: {model_path}")
    print()

    # 10. Visualization (optional)
    try:
        import matplotlib.pyplot as plt

        print("10. Generating visualization...")

        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))

        # Plot 1: Historical data + forecast
        ax1.plot(
            sensor_data["timestamp"],
            sensor_data["value"],
            label="Historical",
            alpha=0.7,
        )

        forecast_times = pd.to_datetime(forecast_24h["timestamps"])
        ax1.plot(
            forecast_times,
            forecast_24h["forecasted_values"],
            "r--",
            label="Forecast (Prophet)",
            linewidth=2,
        )

        if "lower_bound" in forecast_24h:
            ax1.fill_between(
                forecast_times,
                forecast_24h["lower_bound"],
                forecast_24h["upper_bound"],
                alpha=0.2,
                color="red",
                label="95% Confidence Interval",
            )

        ax1.set_xlabel("Time")
        ax1.set_ylabel("Sensor Value")
        ax1.set_title("Temperature Sensor Forecast (Prophet)")
        ax1.legend()
        ax1.grid(True, alpha=0.3)

        # Plot 2: Compare algorithms
        ax2.plot(
            forecast_times,
            forecast_24h["forecasted_values"],
            "r-",
            label="Prophet",
            linewidth=2,
        )
        ax2.plot(
            pd.to_datetime(forecast_xgb["timestamps"]),
            forecast_xgb["forecasted_values"],
            "b-",
            label="XGBoost TS",
            linewidth=2,
        )

        ax2.set_xlabel("Time")
        ax2.set_ylabel("Forecasted Value")
        ax2.set_title("Algorithm Comparison: Prophet vs XGBoost TS")
        ax2.legend()
        ax2.grid(True, alpha=0.3)

        plt.tight_layout()

        # Save plot
        plot_path = Path(__file__).parent / "forecast_comparison.png"
        plt.savefig(plot_path, dpi=150, bbox_inches="tight")
        print(f"    Visualization saved to: {plot_path}")

    except ImportError:
        print("10. Matplotlib not available, skipping visualization")
    print()

    print("=" * 80)
    print("Example completed successfully!")
    print("=" * 80)


if __name__ == "__main__":
    main()
