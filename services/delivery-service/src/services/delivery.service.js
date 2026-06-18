const {
  query,
  publishEvent,
  KAFKA_TOPICS,
  DELIVERY_STATUS,
  ORDER_STATUS,
} = require('@foodflow/shared');

async function createDelivery(orderId, pickupAddress, deliveryAddress) {
  const result = await query(
    `INSERT INTO deliveries (order_id, pickup_address, delivery_address, status)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [orderId, pickupAddress, deliveryAddress, DELIVERY_STATUS.PENDING]
  );
  return result.rows[0];
}

async function assignDeliveryPartner(deliveryId, partnerId) {
  const result = await query(
    `UPDATE deliveries SET delivery_partner_id = $1, status = $2, updated_at = NOW()
     WHERE id = $3 AND status = 'PENDING' RETURNING *`,
    [partnerId, DELIVERY_STATUS.ASSIGNED, deliveryId]
  );

  if (result.rows[0]) {
    await publishEvent(KAFKA_TOPICS.DELIVERY_ASSIGNED, {
      deliveryId,
      orderId: result.rows[0].order_id,
      deliveryPartnerId: partnerId,
      status: DELIVERY_STATUS.ASSIGNED,
    });
  }
  return result.rows[0];
}

async function acceptDelivery(deliveryId, partnerId) {
  const result = await query(
    `UPDATE deliveries SET status = $1, updated_at = NOW()
     WHERE id = $2 AND delivery_partner_id = $3 AND status = 'ASSIGNED' RETURNING *`,
    [DELIVERY_STATUS.ACCEPTED, deliveryId, partnerId]
  );
  return result.rows[0];
}

async function updateDeliveryStatus(deliveryId, partnerId, status, location = null) {
  const validStatuses = ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
  if (!validStatuses.includes(status)) {
    throw Object.assign(new Error('Invalid delivery status'), { status: 400 });
  }

  let queryText = `UPDATE deliveries SET status = $1, updated_at = NOW()`;
  const params = [status, deliveryId, partnerId];

  if (location) {
    queryText += ', current_latitude = $4, current_longitude = $5';
    params.push(location.latitude, location.longitude);
  }

  queryText += ' WHERE id = $2 AND delivery_partner_id = $3 RETURNING *';
  const result = await query(queryText, params);

  if (result.rows[0]) {
    await publishEvent(KAFKA_TOPICS.DELIVERY_STATUS_UPDATED, {
      deliveryId,
      orderId: result.rows[0].order_id,
      deliveryPartnerId: partnerId,
      status,
      location,
    });

    if (location) {
      await publishEvent(KAFKA_TOPICS.DELIVERY_LOCATION_UPDATED, {
        deliveryId,
        orderId: result.rows[0].order_id,
        latitude: location.latitude,
        longitude: location.longitude,
      });
    }

    if (status === DELIVERY_STATUS.DELIVERED) {
      await publishEvent(KAFKA_TOPICS.ORDER_DELIVERED, {
        orderId: result.rows[0].order_id,
        deliveryId,
        deliveryPartnerId: partnerId,
      });
    }
  }

  return result.rows[0];
}

async function getDeliveriesByPartner(partnerId, status) {
  let queryText = 'SELECT d.*, o.status as order_status, o.total_amount FROM deliveries d JOIN orders o ON d.order_id = o.id WHERE d.delivery_partner_id = $1';
  const params = [partnerId];

  if (status) {
    params.push(status);
    queryText += ` AND d.status = $${params.length}`;
  }

  queryText += ' ORDER BY d.created_at DESC';
  const result = await query(queryText, params);
  return result.rows;
}

async function getAvailableDeliveries() {
  const result = await query(
    `SELECT d.*, o.status as order_status, o.total_amount, r.name as restaurant_name
     FROM deliveries d
     JOIN orders o ON d.order_id = o.id
     JOIN restaurants r ON o.restaurant_id = r.id
     WHERE d.status = 'PENDING' ORDER BY d.created_at ASC`
  );
  return result.rows;
}

async function getDeliveryById(deliveryId) {
  const result = await query(
    `SELECT d.*, o.customer_id, o.restaurant_id, o.status as order_status
     FROM deliveries d JOIN orders o ON d.order_id = o.id WHERE d.id = $1`,
    [deliveryId]
  );
  return result.rows[0] || null;
}

async function autoAssignPartner(orderId) {
  const orderResult = await query(
    `SELECT o.*, r.address as pickup_address, a.address_line, a.city, a.state, a.pincode
     FROM orders o
     JOIN restaurants r ON o.restaurant_id = r.id
     LEFT JOIN addresses a ON o.delivery_address_id = a.id
     WHERE o.id = $1`,
    [orderId]
  );

  if (orderResult.rows.length === 0) return null;
  const order = orderResult.rows[0];

  const deliveryAddress = order.address_line
    ? `${order.address_line}, ${order.city}, ${order.state} - ${order.pincode}`
    : 'Address not specified';

  const delivery = await createDelivery(orderId, order.pickup_address, deliveryAddress);

  const partnerResult = await query(
    `SELECT id FROM users WHERE role = 'DELIVERY_PARTNER'
     ORDER BY RANDOM() LIMIT 1`
  );

  if (partnerResult.rows.length > 0) {
    return assignDeliveryPartner(delivery.id, partnerResult.rows[0].id);
  }

  return delivery;
}

module.exports = {
  createDelivery,
  assignDeliveryPartner,
  acceptDelivery,
  updateDeliveryStatus,
  getDeliveriesByPartner,
  getAvailableDeliveries,
  getDeliveryById,
  autoAssignPartner,
};
