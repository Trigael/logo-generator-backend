FROM node:18

WORKDIR /usr/src/app

COPY . .

RUN npm install

RUN npm run build

RUN rm -rf ./src

EXPOSE 4000

# npm run start:prod
CMD ["npm", "run", "start:prod"]