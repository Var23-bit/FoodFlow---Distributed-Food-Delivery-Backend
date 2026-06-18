const { query, paginationMeta } = require('@foodflow/shared');

async function getProfile(userId) {
  const result = await query(
    'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

async function updateProfile(userId, { name, email }) {
  const result = await query(
    `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), updated_at = NOW()
     WHERE id = $3 RETURNING id, name, email, role, updated_at`,
    [name, email?.toLowerCase(), userId]
  );
  return result.rows[0];
}

async function getAddresses(userId) {
  const result = await query(
    'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
    [userId]
  );
  return result.rows;
}

async function addAddress(userId, address) {
  if (address.is_default) {
    await query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
  }
  const result = await query(
    `INSERT INTO addresses (user_id, address_line, city, state, pincode, is_default)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, address.address_line, address.city, address.state, address.pincode, address.is_default || false]
  );
  return result.rows[0];
}

async function updateAddress(userId, addressId, updates) {
  const result = await query(
    `UPDATE addresses SET
       address_line = COALESCE($1, address_line),
       city = COALESCE($2, city),
       state = COALESCE($3, state),
       pincode = COALESCE($4, pincode),
       is_default = COALESCE($5, is_default)
     WHERE id = $6 AND user_id = $7 RETURNING *`,
    [updates.address_line, updates.city, updates.state, updates.pincode, updates.is_default, addressId, userId]
  );
  return result.rows[0];
}

async function deleteAddress(userId, addressId) {
  const result = await query(
    'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id',
    [addressId, userId]
  );
  return result.rows[0];
}

async function getOrderHistory(userId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const countResult = await query('SELECT COUNT(*) FROM orders WHERE customer_id = $1', [userId]);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    `SELECT o.*, r.name as restaurant_name,
       (SELECT json_agg(json_build_object('id', oi.id, 'menu_item_id', oi.menu_item_id,
         'quantity', oi.quantity, 'price', oi.price)) FROM order_items oi WHERE oi.order_id = o.id) as items
     FROM orders o JOIN restaurants r ON o.restaurant_id = r.id
     WHERE o.customer_id = $1 ORDER BY o.created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return { orders: result.rows, pagination: paginationMeta(total, page, limit) };
}

module.exports = {
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getOrderHistory,
};
