FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY shared ./shared
COPY services/payment-service ./services/payment-service
RUN npm install --workspace=@foodflow/payment-service
WORKDIR /app/services/payment-service
EXPOSE 3008
CMD ["node", "src/index.js"]
