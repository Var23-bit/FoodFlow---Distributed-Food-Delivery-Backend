const { KAFKA_TOPICS } = require('@foodflow/shared');
const deliveryService = require('../services/delivery.service');

async function handleOrderEvents(topic, message) {
  if (topic === KAFKA_TOPICS.ORDER_PREPARED || topic === KAFKA_TOPICS.ORDER_READY) {
    console.log(`[Delivery] Order ready for pickup: ${message.orderId}`);
    await deliveryService.autoAssignPartner(message.orderId);
  }
}

module.exports = { handleOrderEvents };
