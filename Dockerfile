FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY *.js ./
RUN chown -R node /usr/src/app
USER node
CMD ["node", "index.js"]
ENV OPENAI_KEY=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
ENV TELEGRAM_KEY=6156548654:AAHjQvGAv6Ga_u4VWkBmp4KvZT2LG9nS9YY
