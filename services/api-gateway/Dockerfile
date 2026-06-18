FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY shared ./shared
COPY services/api-gateway ./services/api-gateway
RUN npm install --workspace=@foodflow/api-gateway
WORKDIR /app/services/api-gateway
EXPOSE 3000
CMD ["node", "src/index.js"]
