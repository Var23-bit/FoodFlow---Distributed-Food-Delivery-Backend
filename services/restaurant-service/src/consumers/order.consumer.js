const { query, publishEvent, KAFKA_TOPICS, ORDER_STATUS } = require('@foodflow/shared');

async function handleOrderEvents(topic, message) {
  if (topic === KAFKA_TOPICS.ORDER_CREATED) {
    console.log(`[Restaurant] New order received: ${message.orderId} for restaurant ${message.restaurantId}`);
  }
}

async function acceptOrder(orderId, restaurantId) {
  const result = await query(
    `UPDATE orders SET status = $1, updated_at = NOW()
     WHERE id = $2 AND restaurant_id = $3 AND status = 'CREATED' RETURNING *`,
    [ORDER_STATUS.CONFIRMED, orderId, restaurantId]
  );

  if (result.rows[0]) {
    await publishEvent(KAFKA_TOPICS.ORDER_CONFIRMED, {
      orderId,
      restaurantId,
      customerId: result.rows[0].customer_id,
      status: ORDER_STATUS.CONFIRMED,
    });
  }
  return result.rows[0];
}

async function rejectOrder(orderId, restaurantId) {
  const result = await query(
    `UPDATE orders SET status = $1, updated_at = NOW()
     WHERE id = $2 AND restaurant_id = $3 AND status = 'CREATED' RETURNING *`,
    [ORDER_STATUS.CANCELLED, orderId, restaurantId]
  );

  if (result.rows[0]) {
    await publishEvent(KAFKA_TOPICS.ORDER_CANCELLED, {
      orderId,
      restaurantId,
      customerId: result.rows[0].customer_id,
      reason: 'Rejected by restaurant',
    });
  }
  return result.rows[0];
}

async function updateOrderStatus(orderId, restaurantId, status) {
  const validStatuses = ['PREPARING', 'READY_FOR_PICKUP'];
  if (!validStatuses.includes(status)) {
    throw Object.assign(new Error('Invalid status for restaurant'), { status: 400 });
  }

  const result = await query(
    `UPDATE orders SET status = $1, updated_at = NOW()
     WHERE id = $2 AND restaurant_id = $3 RETURNING *`,
    [status, orderId, restaurantId]
  );

  if (result.rows[0]) {
    const topic = status === 'PREPARING' ? KAFKA_TOPICS.ORDER_PREPARING : KAFKA_TOPICS.ORDER_PREPARED;
    await publishEvent(topic, {
      orderId,
      restaurantId,
      customerId: result.rows[0].customer_id,
      status,
    });
  }
  return result.rows[0];
}

async function getRestaurantOrders(restaurantId, status, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  let queryText = 'SELECT * FROM orders WHERE restaurant_id = $1';
  const params = [restaurantId];

  if (status) {
    params.push(status);
    queryText += ` AND status = $${params.length}`;
  }

  params.push(limit, offset);
  queryText += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const result = await query(queryText, params);
  return result.rows;
}

module.exports = {
  handleOrderEvents,
  acceptOrder,
  rejectOrder,
  updateOrderStatus,
  getRestaurantOrders,
};
