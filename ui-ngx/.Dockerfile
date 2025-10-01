FROM node:20-slim

RUN apt update

RUN apt install git curl -y

RUN npm i -g @angular/cli

WORKDIR /app/ui-ngx

RUN yarn install

CMD ["yarn", "start"]
# CMD ["tail", "-f"]
