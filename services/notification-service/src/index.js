const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const {
  createPool,
  connectRedis,
  createConsumer,
  KAFKA_TOPICS,
  errorHandler,
  notFound,
} = require('@foodflow/shared');

const notificationRoutes = require('./routes/notification.routes');
const { handleEvents } = require('./consumers/event.consumer');

const app = express();
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3006;

app.use(cors());
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'notification-service' }));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'FoodFlow Notification Service', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3006' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  },
  apis: ['./src/routes/*.js'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/notifications', notificationRoutes);
app.use(notFound);
app.use(errorHandler);

async function start() {
  createPool();
  await connectRedis();
  await createConsumer('notification-service', Object.values(KAFKA_TOPICS), handleEvents);
  app.listen(PORT, () => console.log(`Notification Service running on port ${PORT}`));
}

start();
module.exports = app;
