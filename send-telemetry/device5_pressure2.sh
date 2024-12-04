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

echo -e "DEVICE:\t\tDevice 5"
echo -e "SENSOR:\t\tPressure 2"
echo -e "ACTION:\t\tSending random telemetery data to Thingsboard Cloud {The Pressure Sensor}"
echo -e "LOOP:\t\t$COUNT"
echo -e 'COMMAND:\tmosquitto_pub
                    -d
                    -q 1
                    -h localhost
                    -p 1883
                    -t v1/devices/me/telemetry
                    -u "rm0KqfvfaZgH9OSKYm4n"
                    -m "{pressure:$(seq 0.2625 .001 0.7875 | shuf | head -n1)}"
                    > /dev/null'

trap 'echo -e "\Closed at LOOP: $i, PRESSURE: $VALUE"; exit' SIGINT

echo ''
for ((i=1; i<=COUNT; i++))
do
        VALUE=$(seq 0.2625 .001 0.7875 | shuf | head -n1)
        echo -ne "LOOP: $i, PRESSURE: $VALUE\r"
        sleep 2
        mosquitto_pub -d -q 1 -h localhost -p 1883 -t v1/devices/me/telemetry -u "rm0KqfvfaZgH9OSKYm4n" -m "{pressure:$VALUE}" > /dev/null
done