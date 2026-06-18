const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

dotenv.config({ path: require('path').join(__dirname, '../../../.env') });

const {
  createPool,
  connectRedis,
  publishEvent,
  KAFKA_TOPICS,
  errorHandler,
  notFound,
} = require('@foodflow/shared');

const authRoutes = require('./routes/auth.routes');
const { swaggerOptions } = require('./swagger');

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() });
});

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/auth', authRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    createPool();
    await connectRedis();
    app.listen(PORT, () => {
      console.log(`Auth Service running on port ${PORT}`);
      console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    console.error('Failed to start Auth Service:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
