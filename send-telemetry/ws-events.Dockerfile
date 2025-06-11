FROM python:3.12

WORKDIR /app/send-telemetry

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# CMD ["bash", "-c", "./docker-entry-point-dashboard.sh"]
CMD [ "tail", "-f"]
