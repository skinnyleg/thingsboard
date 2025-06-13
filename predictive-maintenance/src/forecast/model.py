#!/usr/bin/env python
# coding: utf-8

# # Time-Series Forecasting with Deep Learning for Predictive Maintenance
# 
# This notebook is the Kaggle notebook version of the notebook I uploaded in [my Github](https://github.com/jegun19/predictive_maintenance)

# In[3]:


# import sys
# get_ipython().system('{sys.executable} -m pip install -r ../../requirements.txt')


# ## Select one machine
# In this step, we will take a look at the overall characteristic of the data, and then select one machine that we want to analyze and use for doing the predictive maintenance task.

# In[1]:


# Load all csv datas using pandas
import os
import pandas as pd

WORKING_DIR = "../../data/"

df_tele = pd.read_csv(WORKING_DIR + 'PdM_telemetry.csv')
df_fail = pd.read_csv(WORKING_DIR + 'PdM_failures.csv')
df_err = pd.read_csv(WORKING_DIR + 'PdM_errors.csv')
df_maint = pd.read_csv(WORKING_DIR + 'PdM_maint.csv')


# In[2]:


# print the top 5 rows from the failure dataframe
df_fail.head(n=5)


# For simplicity purpose, we will select a single machine that we are going to use for analysis. In this notebook, we will select machine number 11.

# In[3]:


df_sel = df_tele.loc[df_tele['machineID'] == 11].reset_index(drop=True)
df_sel.head(n=5)


# Then, we will look into the error and failure record and then filter it only to show records belonging to machine number 11.

# In[4]:


# Check failure record of machine 11
sel_fail = df_fail.loc[df_fail['machineID'] == 11]
pd.DataFrame(sel_fail)


# In[5]:


# Check error record of machine 11
sel_err = df_err.loc[df_err['machineID'] == 11]
pd.DataFrame(sel_err).head()


# From the explanation regarding the difference between failure and error in Kaggle, it is described that error refers to non-breaking events while failure refers to events that cause the machine to fail. Then, we will see in chronological plot how does the two events relate to each other.

# In[6]:


import matplotlib.pyplot as plt
import matplotlib.dates as mdates

fig, ax = plt.subplots()

# For a simpler plot, we will use two different values in the y-axis to differentiate between error and failure
y_category = list()

for iter in range(0, len(sel_fail)):
  y_category.append('Failure')

for iter in range(0, len(sel_err)):
  y_category.append('Error')

# Get timestamp from error and selected failure
df_timestamp = pd.concat([sel_fail['datetime'], sel_err['datetime']], ignore_index=True, axis=0)
df_plot = pd.DataFrame({"timestamp": df_timestamp, "category": y_category})
df_plot.loc[:, 'timestamp'] = pd.to_datetime(df_plot.loc[:, 'timestamp'])
df_plot.sort_values(by=['timestamp'], inplace=True, ignore_index=True)


# Plot the data with timestamp as x-axis
ax.scatter('timestamp', 'category', data = df_plot)
yearfmt = mdates.DateFormatter('%Y-%m-%d')
ax.xaxis.set_major_formatter(yearfmt)
ax.tick_params(axis='x', rotation=45)
ax.grid()


# From the plot above, we can see that failures are oftentimes preceded by error in the machine. However, not all error result in immediate failures. Some time may passes before the failure in machine occurs. Thus, in the next step, we are going to focus on the failure data and check which feature is affected by machine's failure.

# ## Feature check
# Here, we will select the time window from the failure record, then plot each feature and check their response in the event of failures.

# In[7]:


import datetime
# Change datatype of the timestamp column from object to datetime
df_sel.loc[:, 'datetime'] = pd.to_datetime(df_sel.loc[:, 'datetime'])

# Select the date to check from failure records
st = df_sel.loc[df_sel['datetime'] == datetime.datetime(2015, 2, 19)].index.values[0]

# Then, filter the telemetry data by the date and allow 7 days before and after
# the error occurs to observe any abnormalities.
select = df_sel.loc[st-7*24:st + 7*24,:]

# Plot volt and rotation feature
fig, ax = plt.subplots(nrows=2, sharex=True)
ax[0].plot('datetime', 'volt', data=select)
ax[0].set_ylabel("Volt")

ax[1].plot('datetime', 'rotate', data=select)
ax[1].tick_params(axis='x', rotation=45)
ax[1].set_xlabel("Timestamp")
ax[1].set_ylabel("Rotation")


# As we observe volt and rotation readings, no noticeable anomalies are shown around the period of 2015-02-19. Then, next we will check both pressure and vibration features by plotting them.

# In[8]:


# Plot pressure and vibration feature
fig, ax = plt.subplots(nrows=2, sharex=True)
ax[0].plot('datetime', 'pressure', data=select)
ax[0].set_ylabel("Pressure")

ax[1].plot('datetime', 'vibration', data=select)
ax[1].tick_params(axis='x', rotation=45)
ax[1].set_xlabel("Timestamp")
ax[1].set_ylabel("Vibration")


# Between pressure and vibration, abnormality around the period of 2015-02-19 is more noticeable. Thus, in the next step, we will use <font color='red'>**pressure**</font> as feature and predictor. 

# ## Check autocorrelation and partial autocorrelation
# In time-series data, it is beneficial to check the autocorrelation and partial autocorrelation function of the data that will influence our model selection and parameter selection.

# In[9]:


# Import plotting function
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf

# Autocorrelation plot
plot_acf(df_sel['pressure'], lags = 40)
plt.show()


# From the autocorrelation plot, we can see that the data is positively correlated up to lags of 40, where the autocorrelation value itself is quite low, indicating that the data does not have a strong autocorrelation properties. 

# In[10]:


# Partial autocorrelation plot
plot_pacf(df_sel['pressure'], lags = 40)
plt.show()


# From the partial autocorrelation plot, the correlation between values of two different points in time is also quite weak, decaying to zero starting in the 15th lags. This information will be used in determining the lag in the model.

# # Model Selection

# ## Prepare data input and output
# In this notebook, we will use LSTM model, one of the famous prediction model in time-series forecasting task. To use it, first we need to provide input and output data in the correct format.

# For our experiment, we will use training data of 1 month containing 2015-02-19 period where failure happened to predict another failure which occurs at 2015-04-20 according to the failure record. The feature used will be the pressure reading and timestamp (one-hot encoded).

# In[11]:


import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split

# Select the date to check from failure records
st_train = df_sel.loc[df_sel['datetime'] == datetime.datetime(2015, 2, 19)].index.values[0]

# Then, filter the data to include approximately one month window
start_period = st_train - 14*24
end_period = st_train + 14*24

def create_feature(start, end):
  # create features from the selected machine
  pressure = df_sel.loc[start: end, 'pressure']
  timestamp = pd.to_datetime(df_sel.loc[start: end, 'datetime'])
  timestamp_hour = timestamp.map(lambda x: x.hour)
  timestamp_dow = timestamp.map(lambda x: x.dayofweek)

  # apply one-hot encode for timestamp data
  timestamp_hour_onehot = pd.get_dummies(timestamp_hour).to_numpy()

  # apply min-max scaler to numerical data
  scaler = MinMaxScaler()
  pressure = scaler.fit_transform(np.array(pressure).reshape(-1,1))

  # combine features into one
  feature = np.concatenate([pressure, timestamp_hour_onehot], axis=1)

  X = feature[:-1]
  y = np.array(feature[5:,0]).reshape(-1,1)

  return X, y, scaler

X, y, pres_scaler = create_feature(start_period, end_period)

print(X)


# Then, we need to shape the input further into a sequence (3-dimensional numpy array). We will use a function to return input and output sequence where each input sequence consists of 5-points observation. Simply put, observations of the <font color='red'>**past five hours**</font>  will be used to predict the sensor reading for the next <font color='red'>**one hour**</font> .

# In[12]:


def shape_sequence(arr, step, start):
    out = list()
    for i in range(start, arr.shape[0]):
        low_lim = i
        up_lim = low_lim + step
        out.append(arr[low_lim: up_lim])

        if up_lim == arr.shape[0]:
          # print(i)
          break

    out_seq = np.array(out)
    return out_seq

# Shape the sequence according to the length specified
X_seq = shape_sequence(X, 5, 0)

print("X_seq shape = ", X_seq)
y_seq = shape_sequence(y, 1, 0)

# Separate the input and output for train and validation
X_train, X_val, y_train, y_val = train_test_split(X_seq, y_seq, test_size=0.2, shuffle=False)

print("Training data shape = ", X_train.shape)
print("Validation data shape = ", X_val.shape)


# ## Create prediction model

# Create a simple 2-layer LSTM model with input shape matching the shape of the data sequence provided.

# In[13]:


from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.losses import MeanSquaredError
from tensorflow.keras.callbacks import ModelCheckpoint
import tensorflow.keras.losses as loss
from tensorflow.keras.callbacks import ModelCheckpoint

def create_model(X_train, y_train):
  shape = X_train.shape[1]
  feat_length = X_train.shape[2]

  model = Sequential()
  model.add(LSTM(shape, activation='tanh', input_shape=(shape, feat_length), return_sequences=True))
  model.add(LSTM(shape, activation='tanh', input_shape=(shape, feat_length), return_sequences=False))
  model.add(Dense(shape, activation='relu'))
  model.add(Dense(1, activation='linear'))
  model.compile(optimizer=Adam(learning_rate=0.035),
                loss='mean_squared_error')
  model.fit(X_train, y_train, verbose=0, epochs=500)

  return model

model = create_model(X_train, y_train)


# # Saving the model

# In[14]:


MODEL_PATH = "../../data/models/"
import os
os.makedirs(MODEL_PATH, exist_ok=True)
model.save(MODEL_PATH + "model.h5")


# ## Check validation result
# We will check the model's performance with validation data.

# In[15]:


print("original shape = ", y_val.shape)


# In[ ]:

name = 'PdM_telemetry_MachineID1_mod'
df_df = pd.read_csv("../../../send-telemetry/"+name+".csv", names=['datetime', 'machineID', 'volt', 'rotate', 'pressure', 'vibration'])


# In[ ]:


def create_feature_a():
  # create features from the selected machine
  pressure = df_df.loc[:, 'pressure']
  timestamp = pd.to_datetime(df_df.loc[:, 'datetime'])
  timestamp_hour = timestamp.map(lambda x: x.hour)
  timestamp_dow = timestamp.map(lambda x: x.dayofweek)

  # apply one-hot encode for timestamp data
  timestamp_hour_onehot = pd.get_dummies(timestamp_hour).to_numpy()

  # apply min-max scaler to numerical data
  scaler = MinMaxScaler()
  pressure = scaler.fit_transform(np.array(pressure).reshape(-1,1))

  # combine features into one
  feature = np.concatenate([pressure, timestamp_hour_onehot], axis=1)

  X = feature[:-1]
  y = np.array(feature[5:,0]).reshape(-1,1)

  return X, y, scaler


X_test_new, y_test_new, test_scaler_new = create_feature_a()

print("X_test_new = ", X_test_new)
print("X_test_new shape = ", X_test_new.shape)

# Shape the sequence 
X_test_seq_new = shape_sequence(X_test_new, 5, 0)
print("X_test_seq_new shape = ", X_test_seq_new.shape)
y_test_seq_new = shape_sequence(y_test_new, 1, 0)

# Predict the testing data
y_pred_test_new = model.predict(X_test_seq_new)
print("Pred data[0]", y_pred_test_new[0])

# y_test_seq_new = y_test_seq_new.reshape(-1, 1)
y_pred_test_new = y_pred_test_new.reshape(-1, 1)

# Select first 200 datapoints to allow for better plotting
# Return the value using inverse transform to allow better observation
new_pred = test_scaler_new.inverse_transform(y_pred_test_new)
new_df = pd.DataFrame(new_pred)
new_df
# plt.plot(test_scaler_new.inverse_transform(y_test_seq), 'k', label='Original')



# In[ ]:


new_df.to_csv('../../../send-telemetry/'+name+'_df.csv', index=False)


# In[ ]:


# Predict validation data using the trained model
y_pred = model.predict(X_val)
print("predicted shape = ", X_val[0])
mse = MeanSquaredError()
val_err = mse(y_val.reshape(-1,1), y_pred)
print("Validation error = ", val_err.numpy())
# Return the value using inverse transform to allow better observation
plt.plot(pres_scaler.inverse_transform(y_val.reshape(-1,1)), 'k', label='Original')
plt.plot(pres_scaler.inverse_transform(y_pred.reshape(-1,1)), 'r', label='Prediction')
plt.ylabel("Pressure")
plt.xlabel("Datapoint")
plt.title("Validation data prediction")
plt.legend()
plt.show()


# ## Check test result
# 
# From the plot, we can see that some of the data points are inaccurate, which can be caused by the highly fluctuating nature of the hourly data points. Next, we will see whether the model can predict the sensor reading correctly in the event of anomalies. We are going to pick another date where failure occurred (2015-04-20).

# In[ ]:


# Select the date where another failure occurred
st_test = df_sel.loc[df_sel['datetime'] == datetime.datetime(2015, 4, 20)].index.values[0]

# Then, filter the data to include approximately two-weeks window
start_period_test = st_test - 7*24
end_period_test = st_test + 7*24
X_test, y_test, test_scaler = create_feature(start_period_test, end_period_test)

print("X_test = ", X_test)
print("X_test shape = ", X_test.shape)

# Shape the sequence 
X_test_seq = shape_sequence(X_test, 5, 0)
print("X_test_seq shape = ", X_test_seq.shape)
y_test_seq = shape_sequence(y_test, 1, 0)

# Predict the testing data
y_pred_test = model.predict(X_test_seq)
print("Pred data[0]", y_pred_test[0])
test_err = mse(y_test_seq.reshape(-1,1), y_pred_test)
print("Testing error = ", test_err.numpy())

y_test_seq = y_test_seq.reshape(-1, 1)[:200]
y_pred_test = y_pred_test.reshape(-1, 1)[:200]

# Select first 200 datapoints to allow for better plotting
# Return the value using inverse transform to allow better observation
plt.plot(test_scaler.inverse_transform(y_pred_test), 'r', label='Prediction')
plt.plot(test_scaler.inverse_transform(y_test_seq), 'k', label='Original')
plt.ylabel("Pressure")
plt.xlabel("Datapoints")
plt.legend()
plt.show()


# We observe that the model can predict the sensor reading even in the event of machine failure. The key here is to make sure that the training data that we use to train include past failure event as well.

# ## Predict the Future

# In[ ]:


from copy import deepcopy
CT = 20

recursive_pred = []
X_test_seq = shape_sequence(X_test, 5, 0)
y_pred_future = deepcopy(X_test_seq[-1:])
for i in range(0, CT):
    next_x = y_pred_future[0, -1, 1:].argmax()
    if next_x == 23:
        next_x = 0
    else:
        next_x += 1
    x = np.zeros(24)
    x[next_x] = 1
    val = model.predict(y_pred_future, verbose=0)
    recursive_pred.append(val[0])
    val = np.concatenate([val[0], x])
    y_pred_future[0] = np.concatenate([y_pred_future[0][1:], [val]])
recursive_pred = np.concatenate([y_pred_test, recursive_pred], axis=0)


# In[ ]:


# Select first 200 datapoints to allow for better plotting
# Return the value using inverse transform to allow better observation
plt.plot(test_scaler.inverse_transform(y_pred_test), 'r', label='Prediction')
plt.plot(test_scaler.inverse_transform(y_test_seq), 'k', label='Original')
plt.plot(
    test_scaler.inverse_transform(recursive_pred),
    'gray',
    label='Future Prediction',
    linestyle='dashed',
    alpha=0.5
)
plt.ylabel("Pressure")
plt.xlabel("Datapoints")
plt.legend()
plt.show()


# # Further Steps
# Now that we know how to construct a time-series forecasting model to predict anomalies, there are several possible steps on how to develop a complete predictive maintenance solution:
# * Develop machine learning / deep learning model to predict the chance of machine breakdown by feeding it prediction results from our developed time-series forecasting model.
# * Look into signal processing algorithm to smoothen the signal before feeding it to time-series forecasting model, which could improve model's performance.
# * Use bigger subset of data in training process and check how does the model change, better or worse? 
# * Do hyperparameter optimization to further optimize the performance of time-series forecasting model. 

# # Conclusion
# In this notebook, we have looked into an example predictive maintenance data from Kaggle, do some prior analysis on it, and construct a time-series forecasting model that will predict sensor reading values in the future. Hopefully, this notebook could provide some insights regarding how to implement time-series forecasting with deep learning in predictive maintenance.

# # Loading saved model

# In[ ]:


from tensorflow.keras.models import load_model
new_model = load_model(MODEL_PATH + 'model.h5')


# 

# # Predicting Future from saved model

# In[ ]:


from copy import deepcopy
CT = 20

recursive_pred = []
print(X_test_seq.shape)
y_pred_future = deepcopy(X_test_seq[-5, :])
y_pred_future = shape_sequence(y_pred_future, 5, 0)
for i in range(0, CT):
    next_x = y_pred_future[0, -1, 1:].argmax()
    if next_x == 23:
        next_x = 0
    else:
        next_x += 1
    x = np.zeros(24)
    x[next_x] = 1
    val = new_model.predict(y_pred_future, verbose=0)
    recursive_pred.append(val[0])
    val = np.concatenate([val[0], x])
    y_pred_future[0] = np.concatenate([y_pred_future[0][1:], [val]])
recursive_pred = np.concatenate([y_pred_test, recursive_pred], axis=0)


# In[ ]:


# Select first 200 datapoints to allow for better plotting
# Return the value using inverse transform to allow better observation
plt.plot(test_scaler.inverse_transform(y_pred_test), 'k', label='Prediction')
plt.plot(test_scaler.inverse_transform(y_test_seq), 'r', label='Original')
plt.plot(
    test_scaler.inverse_transform(recursive_pred),
    'b',
    label='Future Prediction',
    linestyle='dashed',
    alpha=0.5
)
plt.ylabel("Pressure")
plt.xlabel("Datapoints")
plt.legend()
plt.show()


# 
