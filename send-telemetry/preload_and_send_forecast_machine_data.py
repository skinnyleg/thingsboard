import asyncio
import requests
from create_alarm import authenticate, create_alarm
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
import logging
import sys
import json
import time

DB_NAME = "thingsboard"
DB_USER = "postgres"
DB_PASSWORD = "postgres"
DB_HOST = "thingsboard_db"
DB_PORT = "5432"

THINGSBOARD_WS_HOST_ADDR = "thingsboard"
THINGSBOARD_WS_PORT = 8080
THINGSBOARD_WS_URL = f"ws://{THINGSBOARD_WS_HOST_ADDR}:{THINGSBOARD_WS_PORT}/api/ws"

# Set up the database URL and connection
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Create the engine
engine = create_engine(DATABASE_URL, echo=True)

# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

f = open("./time-between-forecast.txt", "r")

time_between_forecasts = f.read().strip()

phones_f = open("./send_to_phones.txt", "r")
phones = phones_f.read().strip()

time_alarm = 20  # seconds

entities = {
    "jxl8ni3f0em9zpmuq0oq": [
        "03a88ca0-b63e-11ef-a198-07d41c920fc8",
        "8f14e9f0-d358-11ef-881a-c57f1baedda2",
    ],
    "JfZdCJQMZ6KW1xgHanyN": [
        "f9128fe0-4d49-11f0-adce-4f57de262f63",
        "b53d47f0-4efd-11f0-9172-e9777f6c6d64",
    ],
}

machine_to_set_alarm = entities["JfZdCJQMZ6KW1xgHanyN"][0]

# print("machine_access_token=", machine_access_token)
print("send_to_phones=", phones)
logging.basicConfig()
logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

session = SessionLocal()
conn = session.connection().connection
cur = conn.cursor()


def main():
    try:
        result = session.execute(text("delete from alarm"))
        result = session.execute(
            text(
                "INSERT INTO key_dictionary (key)\
                    VALUES ('pressure'), ('datetime'), ('forecast')\
                    ON CONFLICT (key) DO NOTHING"
            )
        )
        result = session.execute(
            text(
                "SELECT KEY_ID FROM KEY_DICTIONARY WHERE KEY IN ('pressure', 'datetime', 'forecast')"
            )
        )
        session.commit()
        pressure, datetime, forecast = result.scalars().all()

        for token in entities.keys():
            print("token ", token)
            result = session.execute(
                text(
                    f"DELETE FROM public.ts_kv where entity_id = '{entities[token][0]}'"
                ),
            )
            result = session.execute(
                text(
                    f"DELETE FROM public.ts_kv_latest where entity_id = '{entities[token][0]}'"
                ),
            )
            session.commit()
            if (
                os.system(
                    f"bash ./preload_forecast_machine_csv.sh {entities[token][0]} {token} {pressure} {datetime} {forecast}"
                )
                != 0
            ):
                sys.exit("script has failed")
            with open(f"datetime_{token}.csv") as file:
                cur.copy_expert(
                    "COPY ts_kv(ts,str_v,entity_id,key) FROM STDIN WITH (FORMAT csv, DELIMITER ',', HEADER)",
                    file,
                )
                cur.connection.commit()
            with open(f"./pressure_{token}.csv") as file:
                cur.copy_expert(
                    "COPY ts_kv(ts,dbl_v,entity_id,key) FROM STDIN WITH (FORMAT csv, DELIMITER ',', HEADER)",
                    file,
                )
                cur.connection.commit()
            with open(f"./forecast_{token}.csv") as file:
                cur.copy_expert(
                    "COPY ts_kv(ts,dbl_v,entity_id,key) FROM STDIN WITH (FORMAT csv, DELIMITER ',', HEADER)",
                    file,
                )
                cur.connection.commit()
            session.commit()
            try:
                requests.post(
                    f"http://fastapi:8000/forecast/{entities[token][1]}/routine/activate?time_between_forecast="
                    + time_between_forecasts
                )
                pass
            except Exception as e:
                print(f"Error: {e}")
            os.system(f"bash ./test_device_5_3.sh {token} &")
        os.system(f"sleep {time_alarm} && echo 1 > ./set-alarm.txt &")

        token = authenticate()
        token = token.split(" ")[1]

        def check_alarm():
            async def _coroutine():
                while True:
                    try:
                        with open("./set-alarm.txt", "r") as f:
                            if f.read(1).strip() == "1":
                                break
                    except FileNotFoundError:
                        return
                    time.sleep(0.5)
                try:
                    time.sleep(2)
                    alarm = create_alarm(
                        token="Bearer " + token,
                        machine_id=machine_to_set_alarm,
                        alarm_type="pressure threshold",
                    )

                except Exception as e:
                    print(f"Cannot create alarm {e}")
                    return
                try:
                    while True:
                        try:
                            alarm["endTs"] += 1000
                            requests.post(
                                f"http://{THINGSBOARD_WS_HOST_ADDR}:8080/api/alarm",
                                headers={
                                    "X-Authorization": "Bearer " + token,
                                    "Content-Type": "application/json",
                                    "accept": "application/json",
                                },
                                data=json.dumps(alarm),
                            )

                            res = requests.get(
                                f"http://{THINGSBOARD_WS_HOST_ADDR}:8080/api/alarm/info/{alarm['id']['id']}",
                                headers={"X-Authorization": "Bearer " + token},
                            )
                            body = res.json()
                            if body["cleared"]:
                                with open("./set-alarm.txt", "w") as f:
                                    f.write("0")
                                break
                            time.sleep(1)
                        except Exception as e:
                            logging.warning(f"Error: {e}")
                            continue
                except Exception as e:
                    print(f"Error: {e}")

            asyncio.run(_coroutine())

        check_alarm()
    except Exception as e:
        print(e)


if __name__ == "__main__":
    main()
