from typing import Dict, List, NewType, Union
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import load_model
import pandas as pd
import numpy as np
from copy import deepcopy
import datetime
import tensorflow as tf

Data = NewType("Data", Dict[str, List[Union[int, str]]])
MODEL_PATH = "data/models/model.h5"

model = load_model(MODEL_PATH)
print("Num GPUs Available: ", len(tf.config.list_physical_devices("GPU")))
import os

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "0"
scaler = MinMaxScaler()

import logging

logger = logging.getLogger("uvicorn.debug")


def create_feature(df: pd.DataFrame):
    # create features from the selected machine
    pressure = df.loc[:, "pressure"]
    timestamp = pd.to_datetime(df.loc[:, "datetime"])
    timestamp_hour = timestamp.map(lambda x: x.hour)

    # Convert to categorical with full hour range
    timestamp_hour_cat = pd.Categorical(timestamp_hour, categories=list(range(24)))

    # apply one-hot encode for timestamp data
    timestamp_hour_onehot = pd.get_dummies(timestamp_hour_cat)

    timestamp_hour_onehot = timestamp_hour_onehot.to_numpy()

    # logger.warning(f"{len(timestamp_hour_onehot)} {timestamp_hour_onehot}")

    # apply min-max scaler to numerical data
    scaler = MinMaxScaler()
    pressure = scaler.fit_transform(np.array(pressure).reshape(-1, 1))

    # combine features into one
    feature = np.concatenate([pressure, timestamp_hour_onehot], axis=1)

    X = feature[:-1]
    y = np.array(feature[5:, 0]).reshape(-1, 1)

    return X, y, scaler


def shape_sequence(arr, step, start):
    out = list()
    for i in range(start, arr.shape[0]):
        low_lim = i
        up_lim = low_lim + step
        out.append(arr[low_lim:up_lim])

        if up_lim == arr.shape[0]:
            break

    out_seq = np.array(out)
    return out_seq


def predict(tm_data: Data, forecastWindow: int) -> Data:
    df = pd.DataFrame(
        {
            "datetime": [pd.to_datetime(val) for ts, val in tm_data["datetime"]],
            "pressure": [float(val) for ts, val in tm_data["pressure"]],
        }
    )
    X_seq, _, scaler = create_feature(df)
    # logger.warning(f"shape {X_seq.shape}")
    X_seq = shape_sequence(X_seq, 5, 0)
    y_pred_future = deepcopy(X_seq[-1:])
    recursive_pred = {"pressure": [], "datetime": []}
    if len(y_pred_future.shape) != 3 or y_pred_future.shape[2] != 25:
        return recursive_pred
    try:
        for i in range(0, forecastWindow):
            next_x = y_pred_future[0, -1, 1:].argmax()
            if next_x == 23:
                next_x = 0
            else:
                next_x += 1
            x = np.zeros(24)
            x[next_x] = 1
            val = model.predict(y_pred_future, verbose=0)
            recursive_pred["pressure"].append(val[0])
            val = np.concatenate([val[0], x])
            y_pred_future[0] = np.concatenate([y_pred_future[0][1:], [val]])
    except Exception as e:
        logger.warning(f"Exception: {e}")
        return recursive_pred
    recursive_pred["pressure"] = (
        scaler.inverse_transform(np.array(recursive_pred["pressure"]))
        .flatten()
        .tolist()
    )
    current_date = df["datetime"].iloc[-1]
    for _ in range(0, forecastWindow):
        current_date = current_date + datetime.timedelta(hours=1)
        recursive_pred["datetime"].append(str(current_date))
    return recursive_pred
