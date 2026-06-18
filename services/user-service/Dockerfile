FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY shared ./shared
COPY services/user-service ./services/user-service
RUN npm install --workspace=@foodflow/user-service
WORKDIR /app/services/user-service
EXPOSE 3002
CMD ["node", "src/index.js"]
