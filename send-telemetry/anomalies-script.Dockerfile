FROM python:3.12

RUN apt update

RUN apt install -y mosquitto-clients less bc

WORKDIR /app

COPY requirements.txt /app/

RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

CMD ["bash", "-c", "./docker-entry-point-anomalies.sh"]
# CMD [ "tail", "-f"]
