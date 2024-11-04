#!/bin/bash

while true; do
  # Generate a random temperature value between 20 and 30 (optional)
  temperature=$(shuf -i 50-100 -n 1)
  humidity=$(shuf -i 40-60 -n 1)

  # Send the temperature data using curl
  curl -v -X POST http://localhost:4200/api/v1/jmLlaHpAWZr8Byjrh9NS/telemetry \
    --header Content-Type:application/json \
    --data "{\"temperature\":$temperature, \"humidity\":$humidity}"

  # Sleep for 5 seconds before sending the next request
  sleep 1
done
