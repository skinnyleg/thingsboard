# Use docker-compose to build and manage services
COMPOSE=docker compose
MAVEN_RUN=$(COMPOSE) run --rm thingsboard mvn

# Default: compile all modules (Java + rebuild all Docker images)
all: compile-all

# Compile all modules: Java code + rebuild all Docker services
compile-all: compile build-all
	@echo "✅ All modules compiled successfully!"

backup:
	-cp ./application/target/thingsboard-3.7.0-boot.jar ../thingsboard-3.7.0-boot.jar

clean:
	rm -rf **/target
	rm -rf ./ui-ngx/.angular

clean-mvn:
	$(MAVEN_RUN) clean

fclean: clean
	rm -rf ./ui-ngx/node_modules/

# Compile Java code using Maven with docker run
compile:
	$(MAVEN_RUN) install -DskipTests -Dmaven.test.skip

# Compile with debug output
compile-debug:
	$(MAVEN_RUN) -X install -DskipTests -Dmaven.test.skip

# Build all Docker services
build-all:
	$(COMPOSE) build

# Build only thingsboard service
build-thingsboard:
	$(COMPOSE) build thingsboard

# Build only model service
build-model:
	$(COMPOSE) build model

# Build only ui-ngx service
build-ui:
	$(COMPOSE) build ui-ngx

# Rebuild thingsboard and restart
rebuild-thingsboard:
	$(COMPOSE) build thingsboard
	$(COMPOSE) up -d thingsboard

# Rebuild model and restart
rebuild-model:
	$(COMPOSE) build model
	$(COMPOSE) up -d model

# Rebuild ui and restart
rebuild-ui:
	$(COMPOSE) build ui-ngx
	$(COMPOSE) up -d ui-ngx

# Start all services
up:
	$(COMPOSE) up -d

# Stop all services
down:
	$(COMPOSE) down

# View logs
logs:
	$(COMPOSE) logs -f

# View thingsboard logs
logs-thingsboard:
	$(COMPOSE) logs -f thingsboard

# View model logs
logs-model:
	$(COMPOSE) logs -f model

# View ui logs
logs-ui:
	$(COMPOSE) logs -f ui-ngx

# Restart all services
restart:
	$(COMPOSE) restart

# Restart thingsboard
restart-thingsboard:
	$(COMPOSE) restart thingsboard

# Restart model
restart-model:
	$(COMPOSE) restart model

# Restart ui
restart-ui:
	$(COMPOSE) restart ui-ngx

.PHONY: all compile-all backup clean clean-mvn fclean compile compile-debug build-all build-thingsboard build-model build-ui rebuild-thingsboard rebuild-model rebuild-ui up down logs logs-thingsboard logs-model logs-ui restart restart-thingsboard restart-model restart-ui