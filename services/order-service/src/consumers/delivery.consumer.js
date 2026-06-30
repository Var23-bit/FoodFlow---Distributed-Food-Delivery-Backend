const { KAFKA_TOPICS, ORDER_STATUS } = require('@foodflow/shared');
const orderService = require('../services/order.service');

async function handleDeliveryEvents(topic, message) {
  switch (topic) {
    case KAFKA_TOPICS.DELIVERY_ASSIGNED:
      await orderService.assignDeliveryPartner(message.orderId, message.deliveryPartnerId);
      break;
    case KAFKA_TOPICS.DELIVERY_STATUS_UPDATED:
      if (message.status === 'PICKED_UP') {
        await orderService.updateOrderStatus(message.orderId, ORDER_STATUS.PICKED_UP);
      } else if (message.status === 'IN_TRANSIT') {
        await orderService.updateOrderStatus(message.orderId, ORDER_STATUS.OUT_FOR_DELIVERY);
      } else if (message.status === 'DELIVERED') {
        await orderService.updateOrderStatus(message.orderId, ORDER_STATUS.DELIVERED);
      }
      break;
    case KAFKA_TOPICS.ORDER_CONFIRMED:
      console.log(`[Order] Order ${message.orderId} confirmed by restaurant`);
      break;
    default:
      break;
  }
}

module.exports = { handleDeliveryEvents };
