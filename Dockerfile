FROM node:18.14-alpine

RUN mkdir /docs

RUN apk add git

WORKDIR /docs
