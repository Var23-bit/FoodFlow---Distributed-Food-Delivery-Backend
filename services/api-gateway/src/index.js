const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { createProxyMiddleware } = require('http-proxy-middleware');

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const {
  connectRedis,
  createPool,
  createConsumer,
  KAFKA_TOPICS,
  SOCKET_EVENTS,
  rateLimiter,
  errorHandler,
  notFound,
  verifyAccessToken,
} = require('@foodflow/shared');

const adminRoutes = require('./routes/admin.routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.API_GATEWAY_PORT || 3000;

const services = {
  auth: `http://auth-service:${process.env.AUTH_SERVICE_PORT || 3001}`,
  user: `http://user-service:${process.env.USER_SERVICE_PORT || 3002}`,
  restaurant: `http://restaurant-service:${process.env.RESTAURANT_SERVICE_PORT || 3003}`,
  order: `http://order-service:${process.env.ORDER_SERVICE_PORT || 3004}`,
  delivery: `http://delivery-service:${process.env.DELIVERY_SERVICE_PORT || 3005}`,
  notification: `http://notification-service:${process.env.NOTIFICATION_SERVICE_PORT || 3006}`,
  cart: `http://cart-service:${process.env.CART_SERVICE_PORT || 3007}`,
  payment: `http://payment-service:${process.env.PAYMENT_SERVICE_PORT || 3008}`,
};

if (process.env.NODE_ENV !== 'production') {
  services.auth = `http://localhost:${process.env.AUTH_SERVICE_PORT || 3001}`;
  services.user = `http://localhost:${process.env.USER_SERVICE_PORT || 3002}`;
  services.restaurant = `http://localhost:${process.env.RESTAURANT_SERVICE_PORT || 3003}`;
  services.order = `http://localhost:${process.env.ORDER_SERVICE_PORT || 3004}`;
  services.delivery = `http://localhost:${process.env.DELIVERY_SERVICE_PORT || 3005}`;
  services.notification = `http://localhost:${process.env.NOTIFICATION_SERVICE_PORT || 3006}`;
  services.cart = `http://localhost:${process.env.CART_SERVICE_PORT || 3007}`;
  services.payment = `http://localhost:${process.env.PAYMENT_SERVICE_PORT || 3008}`;
}

app.use(cors());
app.use(express.json());

// Apply rate limiting middleware
// If rateLimiter middleware is implemented in shared, it would be used here. 
// Otherwise we'll skip for now as proxy intercepts.
// app.use(rateLimiter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    services: Object.keys(services),
    timestamp: new Date().toISOString(),
  });
});

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FoodFlow API Gateway',
      version: '1.0.0',
      description: 'Unified API gateway for FoodFlow microservices',
    },
    servers: [{ url: 'http://localhost:3000' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    tags: [
      { name: 'Auth' }, { name: 'Users' }, { name: 'Cart' },
      { name: 'Restaurants' }, { name: 'Menu' }, { name: 'Orders' }, { name: 'Payments' },
      { name: 'Deliveries' }, { name: 'Notifications' }, { name: 'Admin' },
    ],
  },
  apis: [],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

function createServiceProxy(target, pathRewrite = {}) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    onProxyReq: (proxyReq, req) => {
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    onError: (err, req, res) => {
      console.error(`Proxy error for ${target}:`, err.message);
      if (!res.headersSent) {
          res.status(503).json({ success: false, message: 'Service temporarily unavailable' });
      }
    },
  });
}

app.use('/api/auth', createServiceProxy(services.auth, { '^/api/auth': '/auth' }));
app.use('/api/users', createServiceProxy(services.user, { '^/api/users': '/users' }));
app.use('/api/cart', createServiceProxy(services.cart, { '^/api/cart': '/cart' }));
app.use('/api/restaurants', createServiceProxy(services.restaurant, { '^/api/restaurants': '/restaurants' }));
app.use('/api/menu', createServiceProxy(services.restaurant, { '^/api/menu': '/menu' }));
app.use('/api/orders', createServiceProxy(services.order, { '^/api/orders': '/orders' }));
app.use('/api/deliveries', createServiceProxy(services.delivery, { '^/api/deliveries': '/deliveries' }));
app.use('/api/notifications', createServiceProxy(services.notification, { '^/api/notifications': '/notifications' }));
app.use('/api/payments', createServiceProxy(services.payment, { '^/api/payments': '/payments' }));

// For admin route if created
try {
  app.use('/api/admin', adminRoutes);
} catch (e) {
  // adminRoutes might not be fully implemented yet
}

const userSockets = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const jwt = require('jsonwebtoken');
    socket.user = jwt.verify(token, process.env.JWT_SECRET || 'foodflow-secret');
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  userSockets.set(userId, socket.id);
  socket.join(`user:${userId}`);
  console.log(`WebSocket connected: user ${userId}`);

  socket.on('subscribe_order', (orderId) => {
    socket.join(`order:${orderId}`);
  });

  socket.on('disconnect', () => {
    userSockets.delete(userId);
    console.log(`WebSocket disconnected: user ${userId}`);
  });
});

function emitToUser(userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
}

function emitToOrder(orderId, event, data) {
  io.to(`order:${orderId}`).emit(event, data);
}

async function handleKafkaEvents(topic, message) {
  try {
    switch (topic) {
      case KAFKA_TOPICS.ORDER_CONFIRMED:
      case KAFKA_TOPICS.ORDER_PREPARING:
      case KAFKA_TOPICS.ORDER_PREPARED:
      case KAFKA_TOPICS.ORDER_PICKED_UP:
      case KAFKA_TOPICS.ORDER_DELIVERED:
      case KAFKA_TOPICS.ORDER_CANCELLED:
        if (message.customerId) emitToUser(message.customerId, 'order_status_updated', message);
        if (message.orderId) emitToOrder(message.orderId, 'order_status_updated', message);
        break;
      case KAFKA_TOPICS.DELIVERY_ASSIGNED:
        if (message.customerId) emitToUser(message.customerId, 'delivery_assigned', message);
        if (message.deliveryPartnerId) emitToUser(message.deliveryPartnerId, 'delivery_assigned', message);
        break;
      case KAFKA_TOPICS.DELIVERY_LOCATION_UPDATED:
        if (message.orderId) emitToOrder(message.orderId, 'delivery_location_updated', message);
        break;
      case KAFKA_TOPICS.PAYMENT_SUCCESSFUL:
      case KAFKA_TOPICS.PAYMENT_FAILED:
        if (message.userId) emitToUser(message.userId, 'payment_update', message);
        if (message.customerId) emitToUser(message.customerId, 'payment_update', message);
        break;
      default:
        if (message.customerId || message.userId) {
          emitToUser(message.customerId || message.userId, 'notification', { topic, ...message });
        }
    }
  } catch (e) {
    console.error('Error handling websocket kafka event', e);
  }
}

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
      createPool();
  } catch(e) {}
  
  await connectRedis();
  try {
    await createConsumer('api-gateway-ws', Object.values(KAFKA_TOPICS), handleKafkaEvents);
  } catch (err) {
    console.warn('Kafka consumer not available yet:', err.message);
  }

  server.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
    console.log(`WebSocket server ready`);
    console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
  });
}

start();

module.exports = { app, server, io };
