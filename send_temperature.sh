#!/bin/bash

while true; do
  # Generate a random temperature value between 20 and 30 (optional)
  temperature=$(shuf -i 20-30 -n 1)

  # Send the temperature data using curl
  curl -v -X POST http://localhost:4200/api/v1/LktTxonGUktLWa7g9l8x/telemetry \
    --header Content-Type:application/json \
    --data "{\"temperature\":$temperature}"

  # Sleep for 5 seconds before sending the next request
  sleep 1
done
