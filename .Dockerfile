FROM maven:3.8.4-openjdk-17-slim

RUN apt update

RUN apt install vim wget tar zip npm git mosquitto-clients -y

# RUN mvn dependency:go-offline

# RUN mvn install -DskipTests -T8

WORKDIR /app

EXPOSE 8081

EXPOSE 7071

EXPOSE 1883

CMD ["java", "-jar", "application/target/thingsboard-3.7.0-boot.jar"]
# CMD [ "tail", "-f"]

