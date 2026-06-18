FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY shared ./shared
COPY services/notification-service ./services/notification-service
RUN npm install --workspace=@foodflow/notification-service
WORKDIR /app/services/notification-service
EXPOSE 3006
CMD ["node", "src/index.js"]
