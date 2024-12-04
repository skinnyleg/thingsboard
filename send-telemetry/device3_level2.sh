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

echo -e "DEVICE:\t\tDevice 3"
echo -e "SENSOR:\t\tLevel 2"
echo -e "ACTION:\t\tSending random telemetery data to Thingsboard Cloud {The Level Sensor}"
echo -e "LOOP:\t\t$COUNT"
echo -e 'COMMAND:\tmosquitto_pub
                    -d
                    -q 1
                    -h localhost
                    -p 1883
                    -t v1/devices/me/telemetry
                    -u "2W8qDjUE3YkUas99J2cy"
                    -m "{level:$(seq 65 .01 75 | shuf | head -n1)}"
                    > /dev/null'

trap 'echo -e "\Closed at LOOP: $i, LEVEL: $VALUE"; exit' SIGINT

echo ''
for ((i=1; i<=COUNT; i++))
do
        VALUE=$(seq 65 .01 75 | shuf | head -n1)
        echo -ne "LOOP: $i, LEVEL: $VALUE\r"
        sleep 2
        mosquitto_pub -d -q 1 -h localhost -p 1883 -t v1/devices/me/telemetry -u "2W8qDjUE3YkUas99J2cy" -m "{level:$VALUE}" > /dev/null
done