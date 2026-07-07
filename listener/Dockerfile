FROM node:20-alpine
WORKDIR /app
COPY listener/package*.json ./
RUN npm ci --omit=dev
COPY listener/ .
COPY contract-config.json /contract-config.json
CMD ["node", "index.js"]
