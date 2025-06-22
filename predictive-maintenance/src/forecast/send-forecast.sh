# echo "Sending $2 to $1"

mosquitto_pub -d -q 1 -h thingsboard -p 1883 -t v1/devices/me/telemetry -u "$1" -m "{forecast:'$2'}" >/dev/null
