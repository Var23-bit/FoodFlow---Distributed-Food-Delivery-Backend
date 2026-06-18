FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY shared ./shared
COPY services/order-service ./services/order-service
RUN npm install --workspace=@foodflow/order-service
WORKDIR /app/services/order-service
EXPOSE 3004
CMD ["node", "src/index.js"]
