from fastapi import APIRouter, HTTPException
from pathlib import Path
import subprocess
from src.db_connector import SessionLocal
from fastapi import Query, WebSocket, WebSocketDisconnect, Header
from fastapi.websockets import WebSocketState
from sqlalchemy import text
from src.db_connector import SessionLocal
import json
import websockets
import asyncio
import time
from src.forecast.predict import predict

router = APIRouter()

THINGSBOARD_WS_HOST_ADDR = "localhost"
THINGSBOARD_WS_PORT = 8081
THINGSBOARD_WS_URL = f"ws://{THINGSBOARD_WS_HOST_ADDR}:{THINGSBOARD_WS_PORT}/api/ws"
SCRIPTS_PATH = "/usr/share/thingsboard/data/predictive-maintenance/forecasts/"
TRAIN_SCRIPT = Path(SCRIPTS_PATH + "train.py")
DB_URL = SessionLocal.kw["bind"].url
FORECAST_WINDOW = 60 * 60
FORECAST_HISTORY_WINDOW = 10 * 24 * 60 * 60


@router.patch("/{forecast_id}/activate")
async def update_forecast(forecast_id: str):
    result = subprocess.run(
        [
            "python",
            str(TRAIN_SCRIPT),
            forecast_id,
            "--data-path",
            SCRIPTS_PATH,
            "--db-url",
            DB_URL,
        ],
        capture_output=True,
        text=True,
    )
    exitcode = result.returncode
    if exitcode != 0:
        ret = {"forecast_id": forecast_id, "status": "failed"}
        raise HTTPException(status_code=500, detail="Failed to update forecast")
    ret = {"forecast_id": forecast_id, "status": "active"}
    return ret


def to_timeseries_ws_cmd(
    device_id: str,
    attribute_keys: list,
    startTs: int,
    timeWindow: int,
    token: str,
):
    return {
        "authCmd": {
            "cmdId": 0,
            "token": token,
        },
        "cmds": [
            {
                "cmdId": 10,
                "entityType": "DEVICE",
                "entityId": device_id,
                "keys": ",".join(attribute_keys),
                "startTs": startTs,
                "timeWindow": timeWindow,
                "scope": "LATEST_TELEMETRY",
                "type": "TIMESERIES",
            },
        ],
    }


@router.websocket("/{forecast_id}/ws")
async def websocket_endpoint(
    client: WebSocket,
    forecast_id: str,
    x_authorization: str = Header(None),
    startTs: int = Query(None),  # seconds
    forecastWindow: int = Query(FORECAST_WINDOW),
):
    if x_authorization is None:
        return await client.close()
    token = x_authorization.split(" ")[1]
    if startTs is None:
        startTs = int(time.time()) - FORECAST_HISTORY_WINDOW
    session = SessionLocal()
    try:
        result = session.execute(
            text(
                f"SELECT device_id, attributes FROM forecast WHERE id = '{forecast_id}'",
            ),
        )
        result = result.fetchone()
        device_id = str(result[0])
        attributes = result[1]
        attribute_keys = [attr["key"] for attr in attributes]
        await client.accept()
        await client.send_text(f"Connected to forecast {forecast_id}")
        async with websockets.connect(THINGSBOARD_WS_URL) as ws:
            await ws.send(
                json.dumps(
                    to_timeseries_ws_cmd(
                        device_id,
                        attribute_keys,
                        startTs * 1000,
                        int(time.time() * 1000),
                        token,
                    )
                )
            )
            tm_data = {key: [] for key in attribute_keys}
            while True:
                try:
                    response = await asyncio.wait_for(ws.recv(), timeout=3)
                    response = json.loads(response)
                    if response["errorCode"] != 0:
                        raise Exception("Error in response")
                    response_data = response["data"]
                    for key in attribute_keys:
                        tm_data[key].extend(response_data[key])
                    forecast_data = predict(tm_data, forecastWindow)
                    await client.send_text(
                        {
                            "forecast": json.dumps(forecast_data),
                            "data": json.dumps(response_data),
                        }
                    )
                except asyncio.exceptions.TimeoutError:
                    print("Timeout")
                    if client.application_state == WebSocketState.CONNECTED:
                        await client.send_text("Keep Alive")
                    continue
    except (WebSocketDisconnect, asyncio.CancelledError):
        if ws.open:
            await ws.close()
        if client.application_state == WebSocketState.CONNECTED:
            await client.close()
    except Exception as e:
        print("Error", e)
        await client.close()
    