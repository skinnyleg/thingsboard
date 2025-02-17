FROM maven:3.8.4-openjdk-17-slim

RUN apt-get update && apt-get install vim wget -y && apt install -f -y

COPY . /tb-app

WORKDIR /tb-app

# RUN mvn dependency:go-offline

# RUN mvn install -DskipTests -T8

WORKDIR /app

EXPOSE 8081

EXPOSE 7071

EXPOSE 1883

CMD ["tail", "-f"]