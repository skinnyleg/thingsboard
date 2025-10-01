FROM maven:3.8.4-openjdk-17-slim

RUN apt update

RUN apt install vim wget tar zip npm git mosquitto-clients -y

# RUN mvn dependency:go-offline

# RUN mvn install -DskipTests -T8

# Set PKG cache path for pkg tool used in js-executor
ENV PKG_CACHE_PATH=/root/.pkg-cache

WORKDIR /app

EXPOSE 8081

EXPOSE 7071

EXPOSE 1883

EXPOSE 8883

CMD ["sh", "-c", "\
    java -jar application/target/thingsboard-3.7.0-boot.jar \
    --spring.datasource.url=jdbc:postgresql://\
    ${POSTGRES_HOST:-database}:5432/${POSTGRES_DB:-thingsboard} \
    --spring.datasource.username=${POSTGRES_USER:-postgres} \
    --spring.datasource.password=${POSTGRES_PASSWORD:-postgres}\
    "]
# CMD [ "tail", "-f"]

