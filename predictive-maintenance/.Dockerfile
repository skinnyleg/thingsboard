FROM python:3.12

RUN apt update

RUN apt install -y mosquitto-clients less

WORKDIR /app

COPY requirements.txt /app/

RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

EXPOSE 8000

# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "debug"]
CMD ["fastapi", "run"]
# CMD ["tail", "-f"]
