# ============================================================================
# IMPORTANT: DO NOT RUN WITH SUDO!
# 
# Run:     make build          ✓ (files owned by you)
# NOT:     sudo make build     ✗ (files owned by root, causes permission issues)
#
# The Makefile uses --user flag to run Docker with your user ID
# ============================================================================

# Run Docker with current user ID to avoid permission issues
# Mount cache directories and configure Maven/Gradle to use them
DOCKER_CMD=docker run --user $(shell id -u):$(shell id -g) \
	-v .:/app/ \
	-v /home/samy/work-projects/thingsboard_m2_cache:/cache/.m2 \
	-v /home/samy/work-projects/thingsboard_npm_cache:/cache/.npm \
	-v /home/samy/work-projects/thingsboard_gradle:/cache/.gradle \
	-v /home/samy/work-projects/thingsboard_pkg_cache:/cache/.pkg-cache \
	-e MAVEN_OPTS="-Dmaven.repo.local=/cache/.m2/repository" \
	-e GRADLE_USER_HOME=/cache/.gradle \
	-e NPM_CONFIG_CACHE=/cache/.npm \
	-e PKG_CACHE_PATH=/cache/.pkg-cache \
	thingsboard-thingsboard:latest

all: build

backup:
	-cp ./application/target/thingsboard-3.7.0-boot.jar ../thingsboard-3.7.0-boot.jar

clean:
	$(DOCKER_CMD) mvn -X clean
	rm -rf **/target
	rm -rf ./ui-ngx/.angular


fclean:
	rm -rf ./ui-ngx/node_modules/


build:
	$(DOCKER_CMD) mvn install -X -DskipTests


clean-mvn:
	$(DOCKER_CMD) mvn clean

build-ui:
	$(DOCKER_CMD) mvn install -X -pl ui-ngx -am -DskipTests

build-js-executor:
	$(DOCKER_CMD) mvn install -X -rf :js-executor -DskipTests