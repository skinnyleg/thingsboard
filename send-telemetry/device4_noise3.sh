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

echo -e "DEVICE:\t\tDevice 4"
echo -e "SENSOR:\t\tNoise 3"
echo -e "ACTION:\t\tSending random telemetery data to Thingsboard Cloud {The Noise Sensor}"
echo -e "LOOP:\t\t$COUNT"
echo -e 'COMMAND:\tmosquitto_pub
                    -d
                    -q 1
                    -h thingsboard
                    -p 1883
                    -t v1/devices/me/telemetry
                    -u "LzxImNW3ZLyXxQRIkBpk"
                    -m "{noise:$(seq 70 .1 90 | shuf | head -n1)}"
                    > /dev/null'

trap 'echo -e "\Closed at LOOP: $i, NOISE: $VALUE"; exit' SIGINT

echo ''
for (( ; ; ))
do
        VALUE=$(seq 70 .1 90 | shuf | head -n1)
        echo -ne "LOOP: $i, NOISE: $VALUE\r"
        sleep 2
        mosquitto_pub -d -q 1 -h thingsboard -p 1883 -t v1/devices/me/telemetry -u "LzxImNW3ZLyXxQRIkBpk" -m "{noise:$VALUE}" > /dev/null
done