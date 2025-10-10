import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import warnings

pd.set_option("display.max_columns", None)


# Feature engineering functions
def create_3h_mean_features(telemetry, fields=["volt", "rotate", "pressure", "vibration"]):
    temp = []
    for col in fields:
        temp.append(
            pd.pivot_table(telemetry, index="datetime", columns="machineID", values=col)
            .resample("3h", closed="left", label="right")
            .mean()
            .unstack()
        )
    telemetry_mean_3h = pd.concat(temp, axis=1)
    telemetry_mean_3h.columns = [i + "mean_3h" for i in fields]
    telemetry_mean_3h.reset_index(inplace=True)

    temp = []
    for col in fields:
        temp.append(
            pd.pivot_table(telemetry, index="datetime", columns="machineID", values=col)
            .resample("3h", closed="left", label="right")
            .std()
            .unstack()
        )
    telemetry_sd_3h = pd.concat(temp, axis=1)
    telemetry_sd_3h.columns = [i + "sd_3h" for i in fields]
    telemetry_sd_3h.reset_index(inplace=True)
    return telemetry_mean_3h, telemetry_sd_3h


def create_24h_mean_features(telemetry, fields=["volt", "rotate", "pressure", "vibration"]):
    temp = []
    for col in fields:
        temp.append(
            pd.pivot_table(telemetry, index="datetime", columns="machineID", values=col)
            .resample("3h", closed="left", label="right")
            .first()
            .unstack()
            .rolling(window=24, center=False)
            .mean()
        )
    telemetry_mean_24h = pd.concat(temp, axis=1)
    telemetry_mean_24h.columns = [i + "mean_24h" for i in fields]
    telemetry_mean_24h.reset_index(inplace=True)
    telemetry_mean_24h = telemetry_mean_24h.loc[-telemetry_mean_24h["voltmean_24h"].isnull()]

    temp = []
    for col in fields:
        temp.append(
            pd.pivot_table(telemetry, index="datetime", columns="machineID", values=col)
            .resample("3h", closed="left", label="right")
            .first()
            .unstack()
            .rolling(window=24, center=False)
            .std()
        )
    telemetry_sd_24h = pd.concat(temp, axis=1)
    telemetry_sd_24h.columns = [i + "sd_24h" for i in fields]
    telemetry_sd_24h.reset_index(inplace=True)
    telemetry_sd_24h = telemetry_sd_24h.loc[-telemetry_sd_24h["voltsd_24h"].isnull()]
    return telemetry_mean_24h, telemetry_sd_24h


def create_telemetry_features(telemetry, fields=["volt", "rotate", "pressure", "vibration"]):
    telemetry_mean_3h, telemetry_sd_3h = create_3h_mean_features(telemetry, fields)
    telemetry_mean_24h, telemetry_sd_24h = create_24h_mean_features(telemetry, fields)
    telemetry_feat = pd.concat(
        [
            telemetry_mean_3h,
            telemetry_sd_3h.iloc[:, 2:6],
            telemetry_mean_24h.iloc[:, 2:6],
            telemetry_sd_24h.iloc[:, 2:6],
        ],
        axis=1,
    ).dropna()
    return telemetry_feat


def create_error_count_features(telemetry, errors):
    error_count = pd.get_dummies(errors.set_index("datetime"), columns=["errorID"]).reset_index()
    error_count = error_count.astype(int, errors="ignore")
    error_count.columns = ["datetime", "machineID", "error1", "error2", "error3", "error4", "error5"]
    error_count["datetime"] = pd.to_datetime(error_count["datetime"])
    error_count = (
        telemetry[["datetime", "machineID"]]
        .merge(error_count, on=["machineID", "datetime"], how="left")
        .fillna(0.0)
    )

    temp = []
    fields = ["error%d" % i for i in range(1, 6)]
    for col in fields:
        temp.append(
            pd.pivot_table(error_count, index="datetime", columns="machineID", values=col)
            .resample("3h", closed="left", label="right")
            .first()
            .unstack()
            .rolling(window=24, center=False)
            .sum()
        )
    error_count = pd.concat(temp, axis=1)
    error_count.columns = [i + "count" for i in fields]
    error_count.reset_index(inplace=True)
    error_count = error_count.dropna()
    return error_count


def create_comp_replacement_features(telemetry, maint):
    print("create_comp_replacement_features", flush=True)
    telemetry["datetime"] = pd.to_datetime(telemetry["datetime"])
    maint["datetime"] = pd.to_datetime(maint["datetime"])

    comp_rep = pd.get_dummies(maint.set_index("datetime")).reset_index()
    comp_rep.columns = ["datetime", "machineID", "comp1", "comp2", "comp3", "comp4"]
    comp_rep = (
        telemetry[["datetime", "machineID"]]
        .merge(comp_rep, on=["datetime", "machineID"], how="outer")
        .fillna(0)
        .sort_values(by=["machineID", "datetime"])
    )

    components = ["comp1", "comp2", "comp3", "comp4"]
    for comp in components:
        comp_rep.loc[comp_rep[comp] < 1, comp] = 0
        comp_rep.loc[comp_rep[comp].notna(), comp] = comp_rep.loc[comp_rep[comp].notna(), "datetime"]
        comp_rep[comp] = comp_rep[comp].fillna(method="ffill")

    comp_rep = comp_rep.loc[comp_rep["datetime"] > pd.to_datetime("2015-01-01")]

    for comp in components:
        comp_rep[comp] = (comp_rep["datetime"] - pd.to_datetime(comp_rep[comp])) / np.timedelta64(1, "D")

    return comp_rep


def merge_features(telemetry_feat, error_count, comp_rep, machines, failures):
    final_feat = telemetry_feat.merge(error_count, on=["datetime", "machineID"], how="left")
    final_feat = final_feat.merge(comp_rep, on=["datetime", "machineID"], how="left")
    final_feat = final_feat.merge(machines, on=["machineID"], how="left")

    final_feat["datetime"] = pd.to_datetime(final_feat["datetime"])
    failures["datetime"] = pd.to_datetime(failures["datetime"])
    labeled_features = final_feat.merge(failures, on=["datetime", "machineID"], how="left")
    labeled_features = labeled_features.fillna(method="bfill", limit=7)
    labeled_features = labeled_features.fillna("none")
    return labeled_features


def create_targets(labeled_features, components=["comp1", "comp2", "comp3", "comp4"]):
    labeled_features = labeled_features.sort_values(["machineID", "datetime"]).reset_index(drop=True)

    target_columns = []
    for hour in range(1, 25):
        target_col = f"target_hour_{hour}_multiclass"
        labeled_features[target_col] = "none"
        target_columns.append(target_col)

        binary_target_col = f"target_hour_{hour}_binary"
        labeled_features[binary_target_col] = 0
        target_columns.append(binary_target_col)

        print(f"Creating targets for hour {hour}...")

        for machine_id in labeled_features["machineID"].unique():
            machine_data = labeled_features[labeled_features["machineID"] == machine_id].copy()
            machine_indices = machine_data.index

            for i, idx in enumerate(machine_indices):
                period_ahead = (hour - 1) // 3 + 1
                future_idx = i + period_ahead
                if future_idx < len(machine_indices):
                    future_failure = labeled_features.loc[machine_indices[future_idx], "failure"]

                    if future_failure != "none" and future_failure in components:
                        labeled_features.loc[idx, target_col] = future_failure
                        labeled_features.loc[idx, binary_target_col] = 1

    return labeled_features


feature_cols = [
    "voltmean_3h", "rotatemean_3h", "pressuremean_3h", "vibrationmean_3h",
    "voltsd_3h", "rotatesd_3h", "pressuresd_3h", "vibrationsd_3h",
    "voltmean_24h", "rotatemean_24h", "pressuremean_24h", "vibrationmean_24h",
    "voltsd_24h", "rotatesd_24h", "pressuresd_24h", "vibrationsd_24h",
    "error1count", "error2count", "error3count", "error4count", "error5count",
    "comp1", "comp2", "comp3", "comp4", "age",
]


def create_labeled_features_clean(labeled_features: pd.DataFrame):
    if "model" in labeled_features.columns:
        le_model = LabelEncoder()
        labeled_features["model_encoded"] = le_model.fit_transform(labeled_features["model"].astype(str))
        if "model_encoded" not in feature_cols:
            feature_cols.append("model_encoded")

    labeled_features_clean = labeled_features.dropna(subset=feature_cols)
    return labeled_features_clean, feature_cols


def split_data(labeled_features_clean: pd.DataFrame, feature_cols: list):
    labeled_features_clean = labeled_features_clean.sort_values(by=["machineID", "datetime"]).reset_index(drop=True)
    buffer = pd.Timedelta(hours=24)

    train_rows = int(0.7 * len(labeled_features_clean))
    train = labeled_features_clean.iloc[:train_rows]

    if train.empty:
        raise ValueError("Not enough data to split into train, val, test sets.")

    val_rows = int(0.5 * (len(labeled_features_clean) - train_rows))
    val = labeled_features_clean.iloc[train_rows : train_rows + val_rows]
    val = val[val["datetime"] > (train["datetime"].max() + buffer)]

    if val.empty:
        raise ValueError("Not enough data to split into train, val, test sets.")

    test = labeled_features_clean.iloc[train_rows + val_rows :]
    test = test[test["datetime"] > (val["datetime"].max() + buffer)]

    if test.empty:
        raise ValueError("Not enough data to split into train, val, test sets.")

    X_train = train[feature_cols]
    X_val = val[feature_cols]
    X_test = test[feature_cols]

    print(f"\nData split completed:", flush=True)
    print(f"Train: {train.shape[0]:,} samples", flush=True)
    print(f"Validation: {val.shape[0]:,} samples", flush=True)
    print(f"Test: {test.shape[0]:,} samples", flush=True)

    return train, val, test, X_train, X_val, X_test


key_hours = [1, 4, 8, 12, 16, 20, 24]


def create_and_train_hourly_models(train, val, test, X_train, X_val, X_test, feature_cols):
    hourly_models = {}
    hourly_results = {}

    for hour in key_hours:
        print(f"\nTraining models for Hour {hour}...")

        multiclass_target = f"target_hour_{hour}_multiclass"
        binary_target = f"target_hour_{hour}_binary"

        y_train_mc = train[multiclass_target]
        y_val_mc = val[multiclass_target]
        y_test_mc = test[multiclass_target]

        y_train_bin = train[binary_target]
        y_val_bin = val[binary_target]
        y_test_bin = test[binary_target]

        if len(y_train_mc.value_counts()) > 1:
            rf_multiclass = RandomForestClassifier(
                n_estimators=100, max_depth=12, min_samples_split=8,
                min_samples_leaf=4, class_weight="balanced", random_state=42, n_jobs=-1,
            )
            rf_multiclass.fit(X_train, y_train_mc)
            hourly_models[f"hour_{hour}_multiclass"] = rf_multiclass

            y_val_pred_mc = rf_multiclass.predict(X_val)
            y_test_pred_mc = rf_multiclass.predict(X_test)

            val_acc_mc = accuracy_score(y_val_mc, y_val_pred_mc)
            test_acc_mc = accuracy_score(y_test_mc, y_test_pred_mc)

            print(f"  Multi-class - Val Acc: {val_acc_mc:.4f}, Test Acc: {test_acc_mc:.4f}")

        if len(y_train_bin.value_counts()) > 1:
            rf_binary = RandomForestClassifier(
                n_estimators=100, max_depth=12, min_samples_split=8,
                min_samples_leaf=4, class_weight="balanced", random_state=42, n_jobs=-1,
            )
            rf_binary.fit(X_train, y_train_bin)
            hourly_models[f"hour_{hour}_binary"] = rf_binary

            y_val_pred_bin = rf_binary.predict(X_val)
            y_test_pred_bin = rf_binary.predict(X_test)

            val_acc_bin = accuracy_score(y_val_bin, y_val_pred_bin)
            test_acc_bin = accuracy_score(y_test_bin, y_test_pred_bin)

            print(f"  Binary - Val Acc: {val_acc_bin:.4f}, Test Acc: {test_acc_bin:.4f}", flush=True)

    print(f"\nHourly models training completed! {len(hourly_models)} models trained.", flush=True)
    return hourly_models


def predict_24h_hourly_failures(
    start_datetime,
    telemetry_data,
    labeled_features_clean,
    feature_cols,
    hourly_models,
):
    """Predict failure probabilities for each hour in the next 24 hours"""
    try:
        start_dt = pd.to_datetime(start_datetime)

        if labeled_features_clean.empty:
            raise ValueError("labeled_features_clean is empty, cannot make predictions")

        # Filter data up to start_datetime
        available_data = labeled_features_clean[labeled_features_clean["datetime"] <= start_dt]
        
        if available_data.empty:
            raise ValueError(f"No data available up to {start_datetime}")
        
        # Get the last row as a Series
        latest_row = available_data.iloc[-1]

        # Build feature vector
        feature_vector = {}
        for col in feature_cols:
            if col in latest_row.index:
                val = latest_row[col]
                if isinstance(val, (np.integer, np.floating)):
                    feature_vector[col] = float(val)
                else:
                    feature_vector[col] = val
            else:
                feature_vector[col] = 0.0

        X_current = pd.DataFrame([feature_vector])[feature_cols]
        X_current = X_current.astype(float)

        predictions = {
            "prediction_start_datetime": str(start_dt),
            "current_telemetry": telemetry_data,
            "hourly_predictions": {},
        }

        for hour in range(1, 25):
            prediction_time = start_dt + pd.Timedelta(hours=hour)
            closest_key_hour = min(key_hours, key=lambda x: abs(x - hour))

            binary_model_key = f"hour_{closest_key_hour}_binary"
            multiclass_model_key = f"hour_{closest_key_hour}_multiclass"

            hour_prediction = {"datetime": str(prediction_time), "hour": hour}

            if binary_model_key in hourly_models:
                binary_model = hourly_models[binary_model_key]
                try:
                    proba = binary_model.predict_proba(X_current)
                    general_failure_prob = float(proba[0, 1])
                    hour_prediction["general_failure_probability"] = round(general_failure_prob, 4)
                    hour_prediction["failure_predicted"] = general_failure_prob > 0.5
                except Exception as e:
                    print(f"Warning: Binary prediction failed for hour {hour}: {e}", flush=True)
                    hour_prediction["general_failure_probability"] = 0.0
                    hour_prediction["failure_predicted"] = False
            else:
                hour_prediction["general_failure_probability"] = 0.0
                hour_prediction["failure_predicted"] = False

            if multiclass_model_key in hourly_models:
                multiclass_model = hourly_models[multiclass_model_key]
                try:
                    component_probs = multiclass_model.predict_proba(X_current)[0]
                    predicted_component = multiclass_model.predict(X_current)[0]

                    component_prob_dict = {}
                    for i, class_name in enumerate(multiclass_model.classes_):
                        component_prob_dict[str(class_name)] = round(float(component_probs[i]), 4)

                    hour_prediction["predicted_failing_component"] = str(predicted_component)
                    hour_prediction["component_probabilities"] = component_prob_dict

                    component_failures = {k: v for k, v in component_prob_dict.items() if k != "none"}
                    hour_prediction["component_failure_probabilities"] = component_failures
                except Exception as e:
                    print(f"Warning: Multiclass prediction failed for hour {hour}: {e}", flush=True)
                    hour_prediction["predicted_failing_component"] = "none"
                    hour_prediction["component_probabilities"] = {"none": 1.0}
                    hour_prediction["component_failure_probabilities"] = {}
            else:
                hour_prediction["predicted_failing_component"] = "none"
                hour_prediction["component_probabilities"] = {"none": 1.0}
                hour_prediction["component_failure_probabilities"] = {}

            predictions["hourly_predictions"][f"hour_{hour}"] = hour_prediction

        return predictions

    except Exception as e:
        import traceback
        print(f"Error in hourly prediction: {e}", flush=True)
        print(f"Traceback: {traceback.format_exc()}", flush=True)
        return {
            "prediction_start_datetime": str(start_datetime),
            "current_telemetry": telemetry_data,
            "hourly_predictions": {},
            "error": str(e)
        }


def save_models(hourly_models: dict, model_path):
    from pathlib import Path
    import joblib

    path = Path(model_path)
    path.mkdir(parents=True, exist_ok=True)

    for model_key, model in hourly_models.items():
        joblib.dump(model, path / f"{model_key}.joblib")

def load_models(model_path):
    from pathlib import Path
    import joblib

    path = Path(model_path)
    hourly_models = {}

    for model_file in path.glob("hour_*.joblib"):
        model_key = model_file.stem
        model = joblib.load(model_file)
        hourly_models[model_key] = model

    return hourly_models

def preprocess_data(telemetry, errors, maint, failures, machines):
    telemetry["datetime"] = pd.to_datetime(telemetry["datetime"])
    telemetry_feat = create_telemetry_features(telemetry)
    error_count = create_error_count_features(telemetry, errors)
    comp_rep = create_comp_replacement_features(telemetry, maint)
    labeled_features = merge_features(telemetry_feat, error_count, comp_rep, machines, failures)
    labeled_features = create_targets(labeled_features)
    labeled_features_clean, feature_cols = create_labeled_features_clean(labeled_features)
    return labeled_features_clean, feature_cols


def train_model(telemetry, errors, maint, failures, machines):
    labeled_features_clean, feature_cols = preprocess_data(telemetry, errors, maint, failures, machines)
    print(f"Labeled features cleaned: {labeled_features_clean.shape}", flush=True)
    
    train, val, test, X_train, X_val, X_test = split_data(labeled_features_clean, feature_cols)
    hourly_models = create_and_train_hourly_models(train, val, test, X_train, X_val, X_test, feature_cols)
    return hourly_models, feature_cols, labeled_features_clean


def predict_failure(start_datetime, telemetry_data, telemetry, errors, maint, failures, machines, feature_cols, hourly_models):
    labeled_features_clean, _ = preprocess_data(telemetry, errors, maint, failures, machines)
    return predict_24h_hourly_failures(start_datetime, telemetry_data, labeled_features_clean, feature_cols, hourly_models)


# Test with dataset data
if __name__ == "__main__":
    # Load data
    telemetry = pd.read_csv("../../data/PdM_telemetry.csv")
    errors = pd.read_csv("../../data/PdM_errors.csv")
    maint = pd.read_csv("../../data/PdM_maint.csv")
    failures = pd.read_csv("../../data/PdM_failures.csv")
    machines = pd.read_csv("../../data/PdM_machines.csv")

    cutoff = pd.to_datetime("2015-01-01 06:00:00")

    telemetry['datetime'] = pd.to_datetime(telemetry['datetime'], errors='coerce')
    telemetry = telemetry.loc[telemetry['datetime'] > cutoff].reset_index(drop=True)

    errors['datetime'] = pd.to_datetime(errors['datetime'], errors='coerce')
    errors = errors.loc[errors['datetime'] > cutoff].reset_index(drop=True)

    maint['datetime'] = pd.to_datetime(maint['datetime'], errors='coerce')
    maint = maint.loc[maint['datetime'] > cutoff].reset_index(drop=True)

    failures['datetime'] = pd.to_datetime(failures['datetime'], errors='coerce')
    failures = failures.loc[failures['datetime'] > cutoff].reset_index(drop=True)

    # Filter for machine 1
    telemetry = telemetry[telemetry["machineID"] == 1]
    errors = errors[errors["machineID"] == 1]
    maint = maint[maint["machineID"] == 1]
    failures = failures[failures["machineID"] == 1]
    machines = machines[machines["machineID"] == 1]

    
    # Train the model
    hourly_models, feature_cols, labeled_features_clean = train_model(telemetry, errors, maint, failures, machines)

    print("\nlabeled_features_clean info:", flush=True)
    print(f"Shape: {labeled_features_clean.shape}", flush=True)
    print(f"Age column: {labeled_features_clean['age'].describe()}", flush=True)

    # Predict failure
    sample_datetime = "2015-01-05 02:00:00"
    sample_telemetry = {"volt": 158, "rotate": 429, "pressure": 94, "vibration": 58}

    result1 = predict_failure(
        sample_datetime,
        sample_telemetry,
        telemetry,
        errors,
        maint,
        failures,
        machines,
        feature_cols,
        hourly_models,
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