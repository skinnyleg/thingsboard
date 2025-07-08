import sys
import time
import json
from create_alarm import authenticate, create_alarm
import asyncio
from entities import (
    entities,
)
import requests
import logging
import os
import signal

THINGSBOARD_WS_HOST_ADDR = "thingsboard"

machine_to_set_alarm = entities["8PyIT47tVem2abB0zi5e"][0]

# catch sigint, sigterm, and sigquit and put 0 in ./set-alarm.txt
def signal_handler(signum, _):
    print(f"Signal {signum} received, stopping the script.")
    with open("./set-alarm.txt", "w") as f:
        f.write("0")
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGQUIT, signal_handler)


def main():
    if len(sys.argv) < 2:
        sys.exit("Fatal: script must take at least 1 argument: [DELAY]")
    
    try:
        sleep_time = int(sys.argv[1])
        if sleep_time < 5:
            sleep_time = 5

        token = authenticate()
        token = token.split(" ")[1]

        os.system(f"sleep {sleep_time} && echo 1 > ./set-alarm.txt &")

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

    except ValueError:
        sys.exit("Fatal: DELAY must be an integer representing seconds to sleep")
    except Exception as e:
        sys.exit(f"Fatal: {e}")


if __name__ == "__main__":
    main()