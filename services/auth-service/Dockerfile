FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY shared ./shared
COPY services/auth-service ./services/auth-service
RUN npm install --workspace=@foodflow/auth-service
WORKDIR /app/services/auth-service
EXPOSE 3001
CMD ["node", "src/index.js"]
