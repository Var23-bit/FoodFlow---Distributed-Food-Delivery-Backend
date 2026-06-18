const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const { createPool, connectRedis, errorHandler, notFound } = require('@foodflow/shared');
const userRoutes = require('./routes/user.routes');
const cartRoutes = require('./routes/cart.routes');

const app = express();
const PORT = process.env.USER_SERVICE_PORT || 3002;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'user-service' }));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'FoodFlow User Service', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3002' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  },
  apis: ['./src/routes/*.js'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/users', userRoutes);
app.use('/cart', cartRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  createPool();
  await connectRedis();
  app.listen(PORT, () => console.log(`User Service running on port ${PORT}`));
}

start();
module.exports = app;
