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

const restaurantRoutes = require('./routes/restaurant.routes');
const menuRoutes = require('./routes/menu.routes');
const { handleOrderEvents } = require('./consumers/order.consumer');

const app = express();
const PORT = process.env.RESTAURANT_SERVICE_PORT || 3003;

app.use(cors());
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'restaurant-service' }));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'FoodFlow Restaurant Service', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3003' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  },
  apis: ['./src/routes/*.js'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/restaurants', restaurantRoutes);
app.use('/menu', menuRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  createPool();
  await connectRedis();
  await createConsumer('restaurant-service', [KAFKA_TOPICS.ORDER_CREATED], handleOrderEvents);
  app.listen(PORT, () => console.log(`Restaurant Service running on port ${PORT}`));
}

start();
module.exports = app;
