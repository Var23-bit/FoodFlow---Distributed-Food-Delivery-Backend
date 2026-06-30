const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const { connectRedis, errorHandler, notFound } = require('@foodflow/shared');
const cartRoutes = require('./routes/cart.routes');

const app = express();
const PORT = process.env.CART_SERVICE_PORT || 3007;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'cart-service' }));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'FoodFlow Cart Service', version: '1.0.0' },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  },
  apis: ['./src/routes/*.js'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/cart', cartRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectRedis();
  app.listen(PORT, () => console.log(`Cart Service running on port ${PORT}`));
}

start();
module.exports = app;
