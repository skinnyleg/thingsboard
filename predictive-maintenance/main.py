#
# Copyright © 2016-2024 The Thingsboard Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

from fastapi import FastAPI, Body, HTTPException
from src.forecast.forecast import router as forecast_router
from src.db_connector import SessionLocal
from sqlalchemy import text
import requests
import datetime
import time
from requests.auth import HTTPBasicAuth

app = FastAPI(
    root_path="/api/v1",
    debug=True,
)

app.include_router(forecast_router, prefix="/forecast")

AccountSid = "xxxxxx"
AccountToken = "xxxxxx"
TwilioSmsFrom = "+xxxxxx"


@app.post("/api/notify-alarm-assignee")
def notify_alarm_assignee(body = Body(None)):
    assignee = body["assigneeId"]
    alarm_type = body["type"]
    alarm_severity = body["severity"]
    alarm_start_ts = body["startTs"]

    session = SessionLocal()
    try:
        result = session.execute(
            text(
                f"SELECT phone from tb_user where id='{assignee}'"
            )
        )
        result = result.fetchone()
        phone = result[0]

        time_fmt = datetime.datetime.fromtimestamp(alarm_start_ts / 1000).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
        sms_body = (
            f"You got assigned a new alarm alert. {alarm_severity}.\nType: {alarm_type}\nStarted at: {time_fmt}"
        )
        try:
            print("phone ", phone)
            print("sms_body ", sms_body)
            print("from ", TwilioSmsFrom)
            print("AccountSid ", AccountSid)
            res = requests.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={"From": TwilioSmsFrom, "To": phone, "Body": sms_body},
                auth=HTTPBasicAuth(AccountSid, AccountToken),
            )
            bod = res.json()
            print(f"Twilio Response {res.status_code} - {bod}")
        except Exception as e:
            print(f"Error: {e}")
            raise HTTPException(status_code=500, detail=f"Could not reach sms provider.\n {e}")            
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=404, detail=f"User was not found.\n {e}")

@app.get("/api/predictiveMaintenance")
def read_root():
    ret = {"Hello": "World"}
    print("Predictive Maintenance API return", ret)
    return ret
