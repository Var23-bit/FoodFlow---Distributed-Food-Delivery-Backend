module.exports = {
  ROLES: {
    CUSTOMER: 'CUSTOMER',
    RESTAURANT_OWNER: 'RESTAURANT_OWNER',
    DELIVERY_PARTNER: 'DELIVERY_PARTNER',
    ADMIN: 'ADMIN',
  },

  ORDER_STATUS: {
    CREATED: 'CREATED',
    CONFIRMED: 'CONFIRMED',
    PREPARING: 'PREPARING',
    READY_FOR_PICKUP: 'READY_FOR_PICKUP',
    PICKED_UP: 'PICKED_UP',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
  },

  DELIVERY_STATUS: {
    PENDING: 'PENDING',
    ASSIGNED: 'ASSIGNED',
    ACCEPTED: 'ACCEPTED',
    PICKED_UP: 'PICKED_UP',
    IN_TRANSIT: 'IN_TRANSIT',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
  },

  KAFKA_TOPICS: {
    ORDER_CREATED: 'order_created',
    ORDER_CONFIRMED: 'order_confirmed',
    ORDER_PREPARING: 'order_preparing',
    ORDER_PREPARED: 'order_prepared',
    ORDER_READY: 'order_ready',
    ORDER_PICKED_UP: 'order_picked_up',
    ORDER_DELIVERED: 'order_delivered',
    ORDER_CANCELLED: 'order_cancelled',
    DELIVERY_ASSIGNED: 'delivery_assigned',
    DELIVERY_STATUS_UPDATED: 'delivery_status_updated',
    DELIVERY_LOCATION_UPDATED: 'delivery_location_updated',
    PAYMENT_COMPLETED: 'payment_completed',
    PAYMENT_SUCCESSFUL: 'payment_successful',
    PAYMENT_FAILED: 'payment_failed',
    USER_REGISTERED: 'user_registered',
    PASSWORD_RESET: 'password_reset',
  },

  REDIS_KEYS: {
    RESTAURANT: (id) => `restaurant:${id}`,
    RESTAURANT_MENU: (id) => `restaurant:${id}:menu`,
    POPULAR_RESTAURANTS: 'restaurants:popular',
    REFRESH_TOKEN: (userId) => `refresh_token:${userId}`,
    CART: (userId) => `cart:${userId}`,
    RATE_LIMIT: (ip) => `rate_limit:${ip}`,
  },

  CACHE_TTL: {
    RESTAURANT: 3600,
    MENU: 1800,
    POPULAR: 900,
    CART: 86400,
  },

  SOCKET_EVENTS: {
    ORDER_STATUS_UPDATED: 'order_status_updated',
    DELIVERY_LOCATION_UPDATED: 'delivery_location_updated',
    DELIVERY_ASSIGNED: 'delivery_assigned',
    NOTIFICATION: 'notification',
  },
};
