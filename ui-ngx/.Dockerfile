FROM node:23-slim

RUN apt update

RUN apt install git -y

WORKDIR /app/ui-ngx

RUN yarn install

CMD ["yarn", "start"]
# CMD ["tail", "-f"]
