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
import smtplib

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    root_path="/api/v1",
    debug=True,
)

origins = [
    "http://10.152.116.13:8080",
    "http://10.152.116.13:4200",
    "http://localhost:8080",
    "http://localhost:4200",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(forecast_router, prefix="/forecast")

EMAIL_ADDRESS = "exampledt6@gmail.com"
APP_PASSWORD = "ohzqlettnpaqxwep"
AccountSid = "xxxxxx"
AccountToken = "xxxxxx"
TwilioSmsFrom = "+xxxxxx"
PhoneNumberID = 752442567942557
Version = "v22.0"
WB_TOKEN = "EAAZARhu4hGY8BOxJqTiMcXWZBZBFZCKemBmHhsMDtmDYV9rvV4EXzukO0eX6obPdctqZCAEfV1JYZBX8TkkSygELJwkeCE8kQ09HW9Oihv2UFRbGfNAzZCyx9zeZCa8tiPCSdgUcPzLwygi64ky0w2c1kZCsh29V9z8aiWO8ZAK2MZAWDs9wxS5aK13qqVANcfIsAZDZD"


def send_notification(phone, body):
    try:
        res = requests.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={"From": TwilioSmsFrom, "To": phone, "Body": body},
            auth=HTTPBasicAuth(AccountSid, AccountToken),
        )
        bod = res.json()
        print(f"Twilio Response {res.status_code} - {bod}")

        res = requests.post(
            f"https://graph.facebook.com/{Version}/{PhoneNumberID}/messages",
            headers={"Authorization": f"Bearer {WB_TOKEN}"},
            json={
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": str(phone),
                "type": "template",
                "template": {
                    "name": "alarms",
                    "language": {"code": "en"},
                    "components": [
                        {
                            "type": "BODY",
                            "parameters": [
                                {
                                    "parameter_name": "severity",
                                    "type": "text",
                                    "text": str(body["severity"]),
                                },
                                {
                                    "parameter_name": "type",
                                    "type": "text",
                                    "text": str(body["type"]),
                                },
                                {
                                    "parameter_name": "start_at",
                                    "type": "text",
                                    "text": str(
                                        datetime.datetime.fromtimestamp(
                                            body["startTs"] / 1000
                                        ).strftime("%Y-%m-%d %H:%M:%S")
                                    ),
                                },
                            ],
                        }
                    ],
                },
            },
        )
        bod = res.json()
        print(f"WB Response {res.status_code} - {bod}")
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Could not reach sms provider.\n {e}"
        )


@app.post("/api/notify-new-alarm")
def notify_new_alarm(body=Body(None)):
    session = SessionLocal()
    result = session.execute(text("SELECT email, phone from tb_user"))
    result = result.fetchall()
    emails = [
        row[0]
        for row in result
        if row[0] is not None
        or row[0] in ("tenant@thingsboard.org", "sysadmin@thingsboard.org")
    ]
    email_body = (
        "Subject: New alarm alert.\n\n"
        + f"You got a new alarm alert.\nType: {body['type']}\n"
        + f"Severity: {body['severity']}\n"
        + f"Started at: {datetime.datetime.fromtimestamp(body['startTs'] / 1000).strftime('%Y-%m-%d %H:%M:%S')}"
        + "\n\nAnalyticalBoard."
    )
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(EMAIL_ADDRESS, APP_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, emails, email_body)
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=f"Could not send email.\n {e}")
    phones = [row[1] for row in result if row[1] is not None]
    try:
        for i in phones:
            send_notification(i, body)
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Could not reach sms provider.\n {e}"
        )


@app.post("/api/notify-claim-assignee")
def notify_claim_assignee(body=Body(None)):
    email = body["email"]
    body = body["body"]

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(EMAIL_ADDRESS, APP_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, email, body)
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=f"Could not send email.\n {e}")


@app.post("/api/notify-alarm-assignee")
def notify_alarm_assignee(body=Body(None)):
    assignee = body["assigneeId"]
    alarm_type = body["type"]
    alarm_severity = body["severity"]
    alarm_start_ts = body["startTs"]

    session = SessionLocal()
    try:
        result = session.execute(
            text(f"SELECT phone, email from tb_user where id='{assignee}'")
        )
        result = result.fetchone()
        phone = result[0]
        email = result[1]
        time_fmt = datetime.datetime.fromtimestamp(alarm_start_ts / 1000).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
        body = (
            "Subject: New alarm assignment.\n\n"
            + f"You got assigned a new alarm alert. {alarm_severity}.\nType: {alarm_type}\nStarted at: {time_fmt}"
            + "\n\nAnalyticalBoard."
        )

        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(EMAIL_ADDRESS, APP_PASSWORD)
                server.sendmail(EMAIL_ADDRESS, email, body)

            send_notification(
                phone,
                {
                    "severity": alarm_severity,
                    "type": alarm_type,
                    "startTs": alarm_start_ts,
                },
            )

        except Exception as e:
            print(f"Error: {e}")
            raise HTTPException(
                status_code=500, detail=f"Could not reach sms provider.\n {e}"
            )
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=404, detail=f"User was not found.\n {e}")


@app.get("/api/predictiveMaintenance")
def read_root():
    ret = {"Hello": "World"}
    print("Predictive Maintenance API return", ret)
    return ret
