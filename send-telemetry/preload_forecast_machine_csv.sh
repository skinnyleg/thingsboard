entity_id="$1"
pressure="$2"
datetime="$3"
forecast="$4"

if [ -z "$entity_id" ] || [ -z "$pressure" ] || [ -z "$datetime" ] || [ -z "$forecast" ]; then
  echo "script must take device [entity_id, pressure_key_id, datetime_key_id, forecast_key_id] as parameters"
  exit 1
fi

path='./PdM_telemetry_MachineID11_OLD_DATA_until_4_16.csv'
forecast_path='./df.csv'

lines=$(wc -l <$path)

seconds_times=$((2 * 30 * 24 * 60 * 60 / $lines))
seconds=$(($lines * $seconds_times))

end_date=$(($(date +%s%3N) + 2000))
start_date=$(($end_date - ($seconds * 1000)))

echo "start_date=$start_date;end_date=$end_date;seconds_times=$seconds_times;seconds=$seconds;lines=$lines"

echo 'ts,dbl_v,entity_id,key' >pressure.csv
echo 'ts,dbl_v,entity_id,key' >forecast.csv
echo 'ts,str_v,entity_id,key' >datetime.csv

start=$start_date
for ((i = 1; i <= $seconds_times; i++)); do
  end=$(($lines * 1000 + $start))
  paste -d ',' \
    <(
      seq $start 1000 $((end - 1000))
    ) \
    <(
      awk \
        -F, \
        -v col2="$entity_id" \
        -v col3="$datetime" \
        '{print $1 "," col2 "," col3}' \
        <$path
    ) \
    >>datetime.csv
  paste -d ',' \
    <(
      seq $start 1000 $((end - 1000))
    ) \
    <(
      awk \
        -F, \
        -v col2="$entity_id" \
        -v col3="$pressure" \
        '{print $5 "," col2 "," col3}' \
        <$path
    ) \
    >>pressure.csv
  paste -d ',' \
    <(
      seq $start 1000 $((end - 1000))
    ) \
    <(
      awk \
        -F, \
        -v col2="$entity_id" \
        -v col3="$forecast" \
        '{print $1 "," col2 "," col3}' \
        <$forecast_path
    ) \
    >>forecast.csv
  start=$end
done
