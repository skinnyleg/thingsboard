FROM python:3.12

RUN apt update

RUN apt install -y mosquitto-clients less

WORKDIR /app/predictive-maintenance

COPY requirements.txt .

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# COPY . /app/

EXPOSE 8000

# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "debug"]
CMD ["fastapi", "run"]
# CMD ["tail", "-f"]


# run fastapi in debug mode - watch file changes

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--log-level", "debug"]