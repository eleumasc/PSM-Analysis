FROM node:22.19.0-slim

RUN apt update && apt install -y sqlite3 curl p7zip-full build-essential python3 python3-dev python3-matplotlib python3-numpy make g++

WORKDIR /root

COPY ./I-Dont-Care-About-Cookies.zip ./I-Dont-Care-About-Cookies.zip
RUN 7z x I-Dont-Care-About-Cookies.zip

COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json

RUN npm run bootstrap

COPY ./.env ./.env

COPY ./tsconfig.json ./tsconfig.json
COPY ./setup ./setup
COPY ./src ./src
COPY ./plots ./plots

RUN npx tsc

RUN node build/scripts/writeCompiledSetup.js

COPY ./pwddataset.json ./pwddataset.json

ENTRYPOINT ["node", "build/index.js"]
