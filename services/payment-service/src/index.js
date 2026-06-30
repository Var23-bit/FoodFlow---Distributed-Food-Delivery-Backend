const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const { createPool, errorHandler, notFound } = require('@foodflow/shared');
const paymentRoutes = require('./routes/payment.routes');

const app = express();
const PORT = process.env.PAYMENT_SERVICE_PORT || 3008;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'payment-service' }));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'FoodFlow Payment Service', version: '1.0.0' },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  },
  apis: ['./src/routes/*.js'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/payments', paymentRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  createPool();
  app.listen(PORT, () => console.log(`Payment Service running on port ${PORT}`));
}

start();
module.exports = app;
