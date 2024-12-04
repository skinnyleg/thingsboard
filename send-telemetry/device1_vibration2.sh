#!/bin/bash

COUNT=1000

if [ -n "$1" ]; then
        if [[ "$1" =~ ^-?[0-9]+$ ]]; then
                COUNT=$((10#$1))
        else
                echo "Parameter is not a valid integer."
                exit 1
        fi
fi

echo -e "DEVICE:\t\tDevice 1"
echo -e "SENSORS:\tVibration 2"
echo -e "ACTION:\t\tSending random telemetery data to Thingsboard Cloud {Conveyor}"
echo -e "LOOP:\t\t$COUNT"
echo -e 'COMMAND:\tmosquitto_pub
                    -d
                    -q 1
                    -h localhost
                    -p 1883
                    -t v1/devices/me/telemetry
                    -u "sc02igdNfcnBceA6Vwh2"
                    -m "{vibration2:$VALUE2}"
                    > /dev/null'

trap 'echo -e "\Closed at LOOP: $i, VIBRATION2: $VALUE2"; exit' SIGINT

echo ''
for ((i=1; i<=COUNT; i++))
do
        VALUE2=$(seq 5000 .1 6000 | shuf | head -1)
        echo -ne "LOOP: $i, VIBRATION2: $VALUE2\r"
        sleep 2
        mosquitto_pub \
                -d \
                -q 1 \
                -h localhost \
                -p 1883 \
                -t v1/devices/me/telemetry \
                -u "sc02igdNfcnBceA6Vwh2" \
                -m "{vibration2:$VALUE2}" \
                > /dev/null
done
