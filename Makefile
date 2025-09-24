DOCKER_CMD=docker run -v .:/app/ -v /home/samy/work-projects/thingsboard_m2_cache:/root/.m2 -v /home/samy/work-projects/thingsboard_npm_cache:/root/.npm -v /home/samy/work-projects/thingsboard_gradle:/root/.gradle thingsboard-tb_application:latest

all: clean build

backup:
	-cp ./application/target/thingsboard-3.7.0-boot.jar ../thingsboard-3.7.0-boot.jar

clean:
	$(DOCKER_CMD) mvn clean
	rm -rf **/target
	rm -rf ./ui-ngx/.angular


fclean:
	rm -rf ./ui-ngx/node_modules/


build:
	$(DOCKER_CMD) mvn install -X -DskipTests


clean-mvn:
	$(DOCKER_CMD) mvn clean
