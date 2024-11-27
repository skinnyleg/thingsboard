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
echo -e "SENSOR:\t\tPressure 3"
echo -e "ACTION:\t\tSending random telemetery data to Thingsboard Cloud {The Pressure Sensor}"
echo -e "LOOP:\t\t$COUNT"
echo -e 'COMMAND:\tmosquitto_pub
                    -d
                    -q 1
                    -h 10.152.188.198
                    -p 1883
                    -t v1/devices/me/telemetry
                    -u "IDFn3qwZCR1DyK2PQ7uA"
                    -m "{pressure:$(seq 0.2625 .001 0.7875 | shuf | head -n1)}"
                    > /dev/null'

trap 'echo -e "\Closed at LOOP: $i, PRESSURE: $VALUE"; exit' SIGINT

path='/home/alabindusrie/Desktop/SamyThingsBoard/predictive-maintenance/data/PdM_telemetry_MachineID11.csv'

echo ''
for ((i=1; i<=COUNT; i++))
do
        # VALUE=$(seq 0.2625 .001 0.7875 | shuf | head -n1)
        # echo -ne "LOOP: $i, PRESSURE: $VALUE\r"
        IFS="," read -r datetime machineId volt rotate pressure vibration
        printf "LOOP: $i, PRESSURE: $pressure, DATETIME: $datetime\r"
        sleep 1
        mosquitto_pub -d -q 1 -h 10.152.188.198 -p 1883 -t v1/devices/me/telemetry -u "IDFn3qwZCR1DyK2PQ7uA" -m "{pressure:$pressure,datetime:'$datetime'}" > /dev/null
done < $path