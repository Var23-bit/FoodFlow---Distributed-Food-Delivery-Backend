const { KAFKA_TOPICS, ORDER_STATUS, publishEvent } = require('@foodflow/shared');
const { updateOrderStatus } = require('../services/order.service');

async function handlePaymentEvents(topic, message) {
  const orderId = message.order_id || message.orderId;
  console.log(`[OrderService] Received event ${topic} for order ${orderId}`);

  if (!orderId) {
    throw new Error('Payment event missing order ID');
  }

  try {
    switch (topic) {
      case KAFKA_TOPICS.PAYMENT_SUCCESSFUL:
        const updatedOrder = await updateOrderStatus(orderId, ORDER_STATUS.CONFIRMED);
        await publishEvent(KAFKA_TOPICS.ORDER_CONFIRMED, {
            orderId: updatedOrder.id,
            customerId: updatedOrder.customer_id,
            restaurantId: updatedOrder.restaurant_id,
            status: updatedOrder.status,
            totalAmount: updatedOrder.total_amount,
        });
        break;
      case KAFKA_TOPICS.PAYMENT_FAILED:
        const failedOrder = await updateOrderStatus(message.order_id, ORDER_STATUS.CANCELLED);
        await publishEvent(KAFKA_TOPICS.ORDER_CANCELLED, {
            orderId: failedOrder.id,
            customerId: failedOrder.customer_id,
            reason: 'Payment failed',
        });
        break;
    }
  } catch (error) {
    console.error(`Error processing payment event ${topic}:`, error);
  }
}

module.exports = { handlePaymentEvents };
