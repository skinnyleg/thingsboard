FROM maven:3.8.5-openjdk-17

WORKDIR /app

COPY . /app/

RUN mvn install -DskipTests -T16

EXPOSE 8080

EXPOSE 1883

CMD ["ping", "google.com"]