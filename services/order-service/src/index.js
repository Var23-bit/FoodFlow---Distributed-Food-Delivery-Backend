const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const { createPool, connectRedis, createConsumer, KAFKA_TOPICS, errorHandler, notFound } = require('@foodflow/shared');
const orderRoutes = require('./routes/order.routes');
const { handleDeliveryEvents } = require('./consumers/delivery.consumer');
const { handlePaymentEvents } = require('./consumers/payment.consumer');

const app = express();
const PORT = process.env.ORDER_SERVICE_PORT || 3004;

app.use(cors());
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order-service' }));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'FoodFlow Order Service', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3004' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  },
  apis: ['./src/routes/*.js'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/orders', orderRoutes);
app.use(notFound);
app.use(errorHandler);

async function start() {
  createPool();
  await connectRedis();
  await createConsumer('order-service', [
    KAFKA_TOPICS.DELIVERY_ASSIGNED,
    KAFKA_TOPICS.DELIVERY_STATUS_UPDATED,
  ], handleDeliveryEvents);
  
  await createConsumer('order-service-payment', [
    KAFKA_TOPICS.PAYMENT_SUCCESSFUL,
    KAFKA_TOPICS.PAYMENT_FAILED,
  ], handlePaymentEvents);
  app.listen(PORT, () => console.log(`Order Service running on port ${PORT}`));
}

start();
module.exports = app;
