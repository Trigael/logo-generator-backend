FROM node:18

WORKDIR /usr/src/app

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY . .

RUN npm install --legacy-peer-deps

RUN echo 1
RUN printenv
RUN echo "$DB_TRANSACTION_URL"
RUN echo 2

RUN npm run build 

RUN rm -rf ./src

EXPOSE 4000

# npm run start:prod
ENTRYPOINT ["/entrypoint.sh"]