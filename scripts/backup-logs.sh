#!/bin/bash

#output directory
output_directory=$OUT_DIRECTORY
# readfile
# readfile="/var/log/thingsboard/thingsboard.log"
readfile=$READFILE
# period time
declare -i period=60 # in seconds

cd /app

mkdir -p "$output_directory"

trap 'exit' 2

while true; do
  timestamp=$(date +%c)
  timeout "$period" tail -n0 -f "$readfile" >"$output_directory/backup_log_$timestamp"
done
