FROM node:20-slim

RUN apt update

WORKDIR /app/ui-ngx

RUN yarn install

CMD ["yarn", "start"]