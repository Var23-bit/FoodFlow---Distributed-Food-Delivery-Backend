FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY shared ./shared
COPY services/cart-service ./services/cart-service
RUN npm install --workspace=@foodflow/cart-service
WORKDIR /app/services/cart-service
EXPOSE 3007
CMD ["node", "src/index.js"]
