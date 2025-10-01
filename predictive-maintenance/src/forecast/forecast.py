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
import requests
import sys
import logging
import os

logger = logging.getLogger("uvicorn.debug")
logger1 = logging.getLogger(__name__)

router = APIRouter(
    prefix="/forecast",
    tags=["forecast"],
)

THINGSBOARD_WS_HOST_ADDR = "thingsboard"
THINGSBOARD_WS_PORT = 8080
THINGSBOARD_WS_URL = f"ws://{THINGSBOARD_WS_HOST_ADDR}:{THINGSBOARD_WS_PORT}/api/ws"
SCRIPTS_PATH = "/usr/share/thingsboard/data/predictive-maintenance/forecasts/"
TRAIN_SCRIPT = Path(SCRIPTS_PATH + "train.py")
DB_URL = SessionLocal.kw["bind"].url
FORECAST_WINDOW = 15
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
                # "limit": 20000,
            },
        ],
    }


def authenticate(username="tenant@thingsboard.org", password="tenant"):
    try:
        res = requests.post(
            f"http://{THINGSBOARD_WS_HOST_ADDR}:8080/api/auth/login",
            headers={"accept": "application/json", "Content-Type": "application/json"},
            data=json.dumps({"username": username, "password": password}),
        )
        body = res.json()
        return body["token"]
    except Exception as e:
        sys.exit(f"Fatal: login failed {e}")


@router.post("/{forecast_id}/routine/activate")
async def activate_forecast_routine(forecast_id: str, time_between_forecast: str):
    # logging.warning(f"time_between_forecasts {int(time_between_forecast)}")
    asyncio.create_task(
        forecast_routine(
            forecast_id=forecast_id,
            time_between_each_forecast=int(time_between_forecast),
            startTs=time.time(),
        )
    )
    return {"status": "success"}


async def forecast_routine(
    forecast_id: str,
    time_between_each_forecast: int,  # seconds
    startTs: float = Query(None),  # ms,
):
    token = authenticate()
    if startTs is None:
        startTs = int(time.time())
    startTs = int(startTs)
    session = SessionLocal()
    try:
        result = session.execute(
            text(
                f"SELECT device_id, attributes FROM forecast WHERE id = '{forecast_id}'",
            ),
        )
        result = result.fetchone()
        session.commit()
        device_id = str(result[0])
        attributes = result[1]
        attributes.append({"key": "datetime"})
        attribute_keys = [attr["key"] for attr in attributes]
        attribute_keys.append("datetime")
        result = session.execute(
            text(
                f"SELECT credentials_id FROM device_credentials where device_id = '{device_id}'"
            ),
        )
        result = result.fetchone()
        session.commit()
        device_token = str(result[0])
        logger.warning(device_token)
        logger.warning("connected to websocket")
        # return
        while True:
            async with websockets.connect(THINGSBOARD_WS_URL) as ws:
                logger.warning("connected to thingsboard socket")
                try:
                    await ws.send(
                        json.dumps(
                            to_timeseries_ws_cmd(
                                device_id,
                                attribute_keys,
                                startTs,
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
                            response_data = response.get("data", None)
                            if not response_data or not response_data.get(
                                "pressure", None
                            ):
                                continue
                            for key in response_data.keys():
                                tm_data[key].extend(response_data[key])
                                tm_data[key] = tm_data[key][-25:]
                            if len(tm_data["pressure"]) >= 24 and len(
                                tm_data["datetime"]
                            ) == len(tm_data["pressure"]):
                                forecast_data = predict(tm_data, 1)
                                os.system(
                                    f"mosquitto_pub -d -q 1 -h thingsboard -p 1883 -t v1/devices/me/telemetry -u "
                                    + device_token
                                    + " -m "
                                    + "'{"
                                    + f"ts: {response_data['pressure'][-1][0] + time_between_each_forecast * 1000}, values:"
                                    + "{"
                                    + f"forecast:'{forecast_data['pressure'][0]}'"
                                    + "}}' >/dev/null"
                                )
                            else:
                                logging.warning(
                                    f"pressure: {len(tm_data['pressure'])}, datetime: {len(tm_data['datetime'])}"
                                )
                        except asyncio.exceptions.TimeoutError:
                            logger.warning("Timeout")
                            continue
                        except Exception as e:
                            logger.warning(f"Loop Exception: {e}")
                            return
                except WebSocketDisconnect as e:
                    logger.warning(f"WebSocketDisconnect: {e}")
    except asyncio.CancelledError as e:
        logger.warning(f"CancelledError: {e}")
    except Exception as e:
        logger.warning(f"Exception: {e}")


@router.websocket("/{forecast_id}/ws")
async def websocket_endpoint(
    client: WebSocket,
    forecast_id: str,
    x_authorization: str = Header(None),
    token: str = Query(None),
    startTs: int = Query(None),  # ms
    forecastWindow: int = Query(FORECAST_WINDOW),
):
    if not token and x_authorization is None:
        return await client.close()
    if not token:
        token = x_authorization.split(" ")[1]
    if startTs is None:
        startTs = int(time.time())
    startTs = int(startTs)
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
        attributes.append({"key": "datetime"})
        attribute_keys = [attr["key"] for attr in attributes]
        attribute_keys.append("datetime")
        attribute_keys.append("forecast")
        await client.accept()
        await client.send_text(f"Connected to forecast {forecast_id}")
        logger.warning("connected to websocket")
        async with websockets.connect(THINGSBOARD_WS_URL) as ws:
            logger.warning("connected to thingsboard socket")
            try:
                await ws.send(
                    json.dumps(
                        to_timeseries_ws_cmd(
                            device_id,
                            attribute_keys,
                            startTs,
                            int(time.time() * 1000),
                            token,
                        )
                    )
                )
                tm_data = {key: [] for key in attribute_keys}
                forecast_data = {"pressure": [], "datetime": []}
                while True:
                    try:
                        response = await asyncio.wait_for(ws.recv(), timeout=3)
                        response = json.loads(response)
                        # logging.warning(response)
                        if response["errorCode"] != 0:
                            raise Exception("Error in response")
                        response_data = response.get("data", None)
                        # logging.warning(f"keys: {response_data.keys()}")
                        if (
                            not response_data or not response_data.get("pressure", None)
                            # or not response_data.get("forecast", None)
                        ):
                            continue
                        for key in response_data.keys():
                            tm_data[key].extend(response_data[key])
                            tm_data[key] = tm_data[key][-25:]
                        if len(tm_data["pressure"]) >= 24 and len(
                            tm_data["pressure"]
                        ) == len(tm_data["datetime"]):
                            forecast_data = predict(tm_data, forecastWindow)
                        await client.send_text(
                            json.dumps(
                                {
                                    "forecast": forecast_data,
                                    "lastestDataValue": response_data["pressure"][-1],
                                    # "data": response_data,
                                }
                            )
                        )
                    except asyncio.exceptions.TimeoutError:
                        logger.warning("Timeout")
                        if client.application_state == WebSocketState.CONNECTED:
                            await client.send_text("Keep Alive")
                        continue
                    except Exception as e:
                        logger.warning(f"Loop Exception: {e}")
                        break
            except WebSocketDisconnect as e:
                logger.warning(f"WebSocketDisconnect: {e}")
                # if ws.open:
                #     await ws.close()
    except asyncio.CancelledError as e:
        logger.warning(f"CancelledError: {e}")
        if client.application_state == WebSocketState.CONNECTED:
            await client.close()
    except Exception as e:
        logger.warning(f"Exception: {e}")
        await client.close()
