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

echo -e "DEVICE:\t\tDevice 2"
echo -e "SENSOR:\t\tTemperature 2"
echo -e "ACTION:\t\tSending random telemetery data to Thingsboard Cloud {The Temperature Sensor}"
echo -e "LOOP:\t\t$COUNT"
echo -e 'COMMAND:\tmosquitto_pub
                    -d
                    -q 1
                    -h thingsboard
                    -p 1883
                    -t v1/devices/me/telemetry
                    -u "cZLVz0o4qx5MIvVv7iz1"
                    -m "{temperature:$(seq 70 .01 80 | shuf | head -n1)}"
                    > /dev/null'

trap 'echo -e "\Closed at LOOP: $i, TEMPERATURE: $VALUE"; exit' SIGINT

echo ''
for (( ; ; ))
do
        VALUE=$(seq 70 .01 80 | shuf | head -n1)
        echo -ne "LOOP: $i, TEMPERATURE: $VALUE\r"
        sleep 2
        mosquitto_pub -d -q 1 -h thingsboard -p 1883 -t v1/devices/me/telemetry -u "cZLVz0o4qx5MIvVv7iz1" -m "{temperature:$VALUE}" > /dev/null
done