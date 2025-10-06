# Unified WebSocket API

## Overview

The unified WebSocket endpoint at `/models/ws/unified` provides a single interface for all model operations, including:

1. **Model Activation (Training)** - Train and deploy models
2. **Prediction Subscription** - Subscribe to real-time predictions
3. **Log Subscription** - Subscribe to real-time logs
4. **Job Management** - Check status, stop jobs

This follows the ThingsBoard command pattern with `commandId` for request/response matching.

## Connection

Connect to: `ws://model:8000/models/ws/unified`

## Message Format

All messages use JSON and include a `commandId` for request/response correlation.

### Request Format
```json
{
  "commandId": 123,
  "type": "command_type",
  "forecastId": "uuid",
  "data": { /* optional command-specific data */ }
}
```

### Response Format
```json
{
  "commandId": 123,
  "type": "response" | "error" | "progress" | "complete" | "prediction" | "logs",
  "message": "...",
  "data": { /* response data */ },
  "timestamp": "2025-10-03T21:30:00.000Z"
}
```

## Commands

### 1. Activate (Train Models)

Trains both AnomalyPredictor and ForecastModel for a forecast.

**Request:**
```json
{
  "commandId": 1,
  "type": "activate",
  "forecastId": "3fabe4d0-a090-11f0-b16b-d544966d18bf",
  "data": {
    "deviceId": "device-uuid"  // optional, will be fetched from config if not provided
  }
}
```

**Progress Responses:**
```json
{
  "commandId": 1,
  "type": "progress",
  "step": "training_anomaly",
  "message": "Training AnomalyPredictor...",
  "progress": 20,
  "timestamp": "2025-10-03T21:30:00.000Z"
}
```

**Completion Response:**
```json
{
  "commandId": 1,
  "type": "complete",
  "message": "Model activation complete",
  "forecastId": "3fabe4d0-a090-11f0-b16b-d544966d18bf",
  "progress": 100,
  "timestamp": "2025-10-03T21:30:00.000Z"
}
```

### 2. Subscribe to Predictions

Subscribe to real-time predictions from a running job.

**Request:**
```json
{
  "commandId": 2,
  "type": "subscribe_predictions",
  "forecastId": "3fabe4d0-a090-11f0-b16b-d544966d18bf",
  "data": {
    "modelType": "anomaly"  // or "forecast"
  }
}
```

**Confirmation:**
```json
{
  "commandId": 2,
  "type": "response",
  "message": "Subscribed to anomaly predictions for 3fabe4d0-a090-11f0-b16b-d544966d18bf",
  "timestamp": "2025-10-03T21:30:00.000Z"
}
```

**Prediction Updates (pushed automatically):**
```json
{
  "type": "prediction",
  "forecastId": "3fabe4d0-a090-11f0-b16b-d544966d18bf",
  "modelType": "anomaly",
  "data": {
    "iteration": 5,
    "status": "running",
    "last_run": "2025-10-03T21:35:00.000Z"
  },
  "timestamp": "2025-10-03T21:35:00.000Z"
}
```

### 3. Unsubscribe from Predictions

**Request:**
```json
{
  "commandId": 3,
  "type": "unsubscribe_predictions",
  "forecastId": "3fabe4d0-a090-11f0-b16b-d544966d18bf",
  "data": {
    "modelType": "anomaly"
  }
}
```

### 4. Subscribe to Logs

Subscribe to real-time logs from a running job.

**Request:**
```json
{
  "commandId": 4,
  "type": "subscribe_logs",
  "forecastId": "3fabe4d0-a090-11f0-b16b-d544966d18bf"
}
```

**Log Updates (pushed automatically):**
```json
{
  "type": "logs",
  "forecastId": "3fabe4d0-a090-11f0-b16b-d544966d18bf",
  "data": {
    "logs": [
      {
        "timestamp": "2025-10-03T21:30:00.000Z",
        "level": "INFO",
        "message": "Running prediction iteration #5"
      }
    ]
  },
  "timestamp": "2025-10-03T21:30:05.000Z"
}
```

### 5. Unsubscribe from Logs

**Request:**
```json
{
  "commandId": 5,
  "type": "unsubscribe_logs",
  "forecastId": "3fabe4d0-a090-11f0-b16b-d544966d18bf"
}
```

### 6. Get Job Status

Request current status of a job.

**Request:**
```json
{
  "commandId": 6,
  "type": "job_status",
  "forecastId": "3fabe4d0-a090-11f0-b16b-d544966d18bf"
}
```

**Response:**
```json
{
  "commandId": 6,
  "type": "response",
  "data": {
    "model_id": "3fabe4d0-a090-11f0-b16b-d544966d18bf/anomaly_predictor",
    "model_type": "AnomalyPredictor",
    "device_id": "device-uuid",
    "status": "running",
    "start_time": "2025-10-03T21:25:00.000Z",
    "last_run": "2025-10-03T21:35:00.000Z",
    "iterations": 5
  },
  "timestamp": "2025-10-03T21:35:05.000Z"
}
```

### 7. Get Job Logs

Request historical logs.

**Request:**
```json
{
  "commandId": 7,
  "type": "job_logs",
  "forecastId": "3fabe4d0-a090-11f0-b16b-d544966d18bf",
  "data": {
    "limit": 50  // optional, default 100
  }
}
```

**Response:**
```json
{
  "commandId": 7,
  "type": "response",
  "data": {
    "logs": [
      {
        "timestamp": "2025-10-03T21:30:00.000Z",
        "level": "INFO",
        "message": "Job started successfully"
      }
    ],
    "count": 1
  },
  "timestamp": "2025-10-03T21:35:05.000Z"
}
```

### 8. Stop Job

Stop a running prediction job.

**Request:**
```json
{
  "commandId": 8,
  "type": "stop_job",
  "forecastId": "3fabe4d0-a090-11f0-b16b-d544966d18bf"
}
```

**Response:**
```json
{
  "commandId": 8,
  "type": "response",
  "message": "Job stopped for 3fabe4d0-a090-11f0-b16b-d544966d18bf",
  "success": true,
  "timestamp": "2025-10-03T21:35:05.000Z"
}
```

### 9. Ping (Health Check)

**Request:**
```json
{
  "commandId": 9,
  "type": "ping"
}
```

**Response:**
```json
{
  "commandId": 9,
  "type": "pong",
  "timestamp": "2025-10-03T21:35:05.000Z"
}
```

## Usage Examples

### Python Client Example

```python
import asyncio
import json
import websockets

async def unified_client():
    uri = "ws://model:8000/models/ws/unified"

    async with websockets.connect(uri) as websocket:
        # Wait for connection confirmation
        response = await websocket.recv()
        print(f"Connected: {response}")

        # 1. Activate models
        await websocket.send(json.dumps({
            "commandId": 1,
            "type": "activate",
            "forecastId": "3fabe4d0-a090-11f0-b16b-d544966d18bf"
        }))

        # Receive progress updates
        while True:
            response = json.loads(await websocket.recv())
            print(f"Progress: {response}")

            if response.get("type") == "complete":
                break

        # 2. Subscribe to predictions
        await websocket.send(json.dumps({
            "commandId": 2,
            "type": "subscribe_predictions",
            "forecastId": "3fabe4d0-a090-11f0-b16b-d544966d18bf",
            "data": {"modelType": "anomaly"}
        }))

        # Receive prediction updates
        while True:
            response = json.loads(await websocket.recv())
            print(f"Update: {response}")

asyncio.run(unified_client())
```

### JavaScript Client Example

```javascript
const ws = new WebSocket('ws://model:8000/models/ws/unified');
let commandId = 1;

ws.onopen = () => {
    console.log('Connected');

    // Activate models
    ws.send(JSON.stringify({
        commandId: commandId++,
        type: 'activate',
        forecastId: '3fabe4d0-a090-11f0-b16b-d544966d18bf'
    }));
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received:', data);

    if (data.type === 'complete') {
        // Subscribe to predictions
        ws.send(JSON.stringify({
            commandId: commandId++,
            type: 'subscribe_predictions',
            forecastId: '3fabe4d0-a090-11f0-b16b-d544966d18bf',
            data: { modelType: 'anomaly' }
        }));
    }
};
```

## Error Handling

All errors are returned with `type: "error"`:

```json
{
  "commandId": 123,
  "type": "error",
  "message": "Error description",
  "timestamp": "2025-10-03T21:30:00.000Z"
}
```

Common errors:
- Missing `commandId`
- Missing `forecastId`
- Unknown command type
- No active job found
- Training failure

## Migration from Legacy Endpoints

### Old Approach (Multiple Endpoints)
- `/models/ws/{forecast_id}/activate` - Model activation
- `/models/ws/job` - Job monitoring
- `/models/ws/{forecast_id}/anomalies` - Anomaly streaming

### New Approach (Unified Endpoint)
- `/models/ws/unified` - All operations

The legacy endpoints are still available for backward compatibility.
