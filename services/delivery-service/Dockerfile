FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY shared ./shared
COPY services/delivery-service ./services/delivery-service
RUN npm install --workspace=@foodflow/delivery-service
WORKDIR /app/services/delivery-service
EXPOSE 3005
CMD ["node", "src/index.js"]
