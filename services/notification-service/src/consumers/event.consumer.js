const { KAFKA_TOPICS } = require('@foodflow/shared');
const { query } = require('@foodflow/shared');
const notificationService = require('../services/notification.service');

const EVENT_TEMPLATES = {
  [KAFKA_TOPICS.ORDER_CREATED]: {
    title: 'Order Placed',
    message: (m) => `Your order #${m.orderId?.slice(0, 8)} has been placed successfully.`,
    getUserId: (m) => m.customerId,
  },
  [KAFKA_TOPICS.ORDER_CONFIRMED]: {
    title: 'Order Confirmed',
    message: (m) => `Your order #${m.orderId?.slice(0, 8)} has been confirmed by the restaurant.`,
    getUserId: (m) => m.customerId,
  },
  [KAFKA_TOPICS.ORDER_PREPARING]: {
    title: 'Order Being Prepared',
    message: (m) => `Your order #${m.orderId?.slice(0, 8)} is being prepared.`,
    getUserId: (m) => m.customerId,
  },
  [KAFKA_TOPICS.ORDER_PREPARED]: {
    title: 'Order Ready',
    message: (m) => `Your order #${m.orderId?.slice(0, 8)} is ready for pickup.`,
    getUserId: (m) => m.customerId,
  },
  [KAFKA_TOPICS.DELIVERY_ASSIGNED]: {
    title: 'Delivery Assigned',
    message: (m) => `A delivery partner has been assigned to your order.`,
    getUserId: async (m) => {
      const result = await query('SELECT customer_id FROM orders WHERE id = $1', [m.orderId]);
      return result.rows[0]?.customer_id;
    },
  },
  [KAFKA_TOPICS.ORDER_DELIVERED]: {
    title: 'Order Delivered',
    message: (m) => `Your order #${m.orderId?.slice(0, 8)} has been delivered. Enjoy your meal!`,
    getUserId: async (m) => {
      const result = await query('SELECT customer_id FROM orders WHERE id = $1', [m.orderId]);
      return result.rows[0]?.customer_id;
    },
  },
  [KAFKA_TOPICS.PAYMENT_COMPLETED]: {
    title: 'Payment Successful',
    message: (m) => `Payment of $${m.amount} for order #${m.orderId?.slice(0, 8)} was successful.`,
    getUserId: (m) => m.customerId,
  },
  [KAFKA_TOPICS.PAYMENT_SUCCESSFUL]: {
    title: 'Payment Confirmed',
    message: (m) => `Payment confirmed for order #${m.orderId?.slice(0, 8)}.`,
    getUserId: (m) => m.userId || m.customerId,
  },
  [KAFKA_TOPICS.PAYMENT_FAILED]: {
    title: 'Payment Failed',
    message: (m) => `Payment failed for order #${m.orderId?.slice(0, 8)}.`,
    getUserId: (m) => m.userId || m.customerId,
  },
  [KAFKA_TOPICS.DELIVERY_STATUS_UPDATED]: {
    title: 'Delivery Status Updated',
    message: (m) => `Delivery status updated to ${m.status} for order #${m.orderId?.slice(0, 8)}.`,
    getUserId: async (m) => {
      const result = await query('SELECT customer_id FROM orders WHERE id = $1', [m.orderId]);
      return result.rows[0]?.customer_id;
    },
  },
  [KAFKA_TOPICS.ORDER_CANCELLED]: {
    title: 'Order Cancelled',
    message: (m) => `Your order #${m.orderId?.slice(0, 8)} has been cancelled.`,
    getUserId: (m) => m.customerId,
  },
  [KAFKA_TOPICS.PASSWORD_RESET]: {
    title: 'Password Reset',
    message: () => 'A password reset link has been sent to your email.',
    getUserId: (m) => m.userId,
    email: (m) => ({ to: m.email, subject: 'Password Reset', body: `Reset token: ${m.token}` }),
  },
};

async function handleEvents(topic, message) {
  const template = EVENT_TEMPLATES[topic];
  if (!template) return;

  try {
    const userId = typeof template.getUserId === 'function'
      ? await template.getUserId(message)
      : template.getUserId(message);

    if (!userId) return;

    await notificationService.createNotification(userId, {
      type: topic,
      title: template.title,
      message: template.message(message),
      metadata: message,
    });

    if (template.email) {
      const emailData = template.email(message);
      await notificationService.sendMockEmail(emailData.to, emailData.subject, emailData.body);
    }

    const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userResult.rows[0] && !template.email) {
      await notificationService.sendMockEmail(
        userResult.rows[0].email,
        template.title,
        template.message(message)
      );
    }
  } catch (err) {
    console.error(`Failed to process notification for ${topic}:`, err);
  }
}

module.exports = { handleEvents };
