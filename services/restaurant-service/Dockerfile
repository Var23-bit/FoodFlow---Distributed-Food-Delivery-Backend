FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY shared ./shared
COPY services/restaurant-service ./services/restaurant-service
RUN npm install --workspace=@foodflow/restaurant-service
WORKDIR /app/services/restaurant-service
EXPOSE 3003
CMD ["node", "src/index.js"]
