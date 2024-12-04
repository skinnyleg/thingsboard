#!/bin/sh

trap 'exit' INT TERM ERR
trap 'echo && kill 0' EXIT

for i in $(find . -name "device*.sh"); do
	echo "bash $i"
	bash $i >/dev/null &
done

echo 
echo -n "Waiting for all processes to finish"
wait
