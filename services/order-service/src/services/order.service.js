const {
  query,
  getClient,
  publishEvent,
  KAFKA_TOPICS,
  ORDER_STATUS,
  cacheGet,
  cacheDel,
  REDIS_KEYS,
} = require('@foodflow/shared');

async function placeOrder(customerId, { restaurantId, items, deliveryAddressId, notes }) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const menuResult = await client.query(
      'SELECT id, price, availability, name FROM menu_items WHERE id = ANY($1) AND restaurant_id = $2',
      [items.map((i) => i.menuItemId), restaurantId]
    );

    if (menuResult.rows.length !== items.length) {
      throw Object.assign(new Error('Some menu items are invalid or unavailable'), { status: 400 });
    }

    const unavailable = menuResult.rows.filter((m) => !m.availability);
    if (unavailable.length > 0) {
      throw Object.assign(new Error('Some items are unavailable'), { status: 400 });
    }

    const menuMap = Object.fromEntries(menuResult.rows.map((m) => [m.id, m]));
    let totalAmount = 0;
    const orderItems = items.map((item) => {
      const menuItem = menuMap[item.menuItemId];
      const price = parseFloat(menuItem.price);
      totalAmount += price * item.quantity;
      return { menuItemId: item.menuItemId, quantity: item.quantity, price, name: menuItem.name };
    });

    const orderResult = await client.query(
      `INSERT INTO orders (customer_id, restaurant_id, delivery_address_id, status, total_amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [customerId, restaurantId, deliveryAddressId, ORDER_STATUS.CREATED, totalAmount, notes]
    );

    const order = orderResult.rows[0];

    for (const item of orderItems) {
      await client.query(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [order.id, item.menuItemId, item.quantity, item.price]
      );
    }

    await client.query('COMMIT');

    await cacheDel(REDIS_KEYS.CART(customerId));

    await publishEvent(KAFKA_TOPICS.ORDER_CREATED, {
      orderId: order.id,
      customerId,
      restaurantId,
      totalAmount,
      items: orderItems,
      status: ORDER_STATUS.CREATED,
    });

    await publishEvent(KAFKA_TOPICS.PAYMENT_COMPLETED, {
      orderId: order.id,
      customerId,
      amount: totalAmount,
    });

    return { ...order, items: orderItems };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getOrderById(orderId, userId, role) {
  const result = await query(
    `SELECT o.*, r.name as restaurant_name, r.address as restaurant_address,
       (SELECT json_agg(json_build_object('id', oi.id, 'menu_item_id', oi.menu_item_id,
         'quantity', oi.quantity, 'price', oi.price,
         'name', mi.name)) FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id WHERE oi.order_id = o.id) as items
     FROM orders o JOIN restaurants r ON o.restaurant_id = r.id WHERE o.id = $1`,
    [orderId]
  );

  const order = result.rows[0];
  if (!order) return null;

  const canView =
    order.customer_id === userId ||
    role === 'ADMIN' ||
    (role === 'DELIVERY_PARTNER' && order.delivery_partner_id === userId);

  if (!canView && role === 'RESTAURANT_OWNER') {
    const ownerCheck = await query('SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2', [order.restaurant_id, userId]);
    if (ownerCheck.rows.length === 0) return null;
  } else if (!canView) {
    return null;
  }

  return order;
}

async function cancelOrder(orderId, customerId) {
  const result = await query(
    `UPDATE orders SET status = $1, updated_at = NOW()
     WHERE id = $2 AND customer_id = $3 AND status IN ('CREATED', 'CONFIRMED') RETURNING *`,
    [ORDER_STATUS.CANCELLED, orderId, customerId]
  );

  if (result.rows[0]) {
    await publishEvent(KAFKA_TOPICS.ORDER_CANCELLED, {
      orderId,
      customerId,
      reason: 'Cancelled by customer',
    });
  }
  return result.rows[0];
}

async function updateOrderStatus(orderId, status, deliveryPartnerId = null) {
  let queryText = 'UPDATE orders SET status = $1, updated_at = NOW()';
  const params = [status, orderId];

  if (deliveryPartnerId) {
    queryText += ', delivery_partner_id = $3';
    params.push(deliveryPartnerId);
  }

  queryText += ' WHERE id = $2 RETURNING *';
  const result = await query(queryText, params);
  return result.rows[0];
}

async function getOrdersByCustomer(customerId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const result = await query(
    'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [customerId, limit, offset]
  );
  return result.rows;
}

module.exports = {
  placeOrder,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
  getOrdersByCustomer,
};
