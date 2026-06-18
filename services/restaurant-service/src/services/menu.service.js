const {
  query,
  cacheGet,
  cacheSet,
  cacheDel,
  REDIS_KEYS,
  CACHE_TTL,
} = require('@foodflow/shared');

async function createMenuItem(restaurantId, data) {
  const result = await query(
    `INSERT INTO menu_items (restaurant_id, name, description, price, category, availability)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [restaurantId, data.name, data.description, data.price, data.category, data.availability ?? true]
  );
  await cacheDel(REDIS_KEYS.RESTAURANT_MENU(restaurantId));
  return result.rows[0];
}

async function getMenuByRestaurant(restaurantId) {
  const cached = await cacheGet(REDIS_KEYS.RESTAURANT_MENU(restaurantId));
  if (cached) return cached;

  const result = await query(
    'SELECT * FROM menu_items WHERE restaurant_id = $1 ORDER BY category, name',
    [restaurantId]
  );
  await cacheSet(REDIS_KEYS.RESTAURANT_MENU(restaurantId), result.rows, CACHE_TTL.MENU);
  return result.rows;
}

async function getMenuItemById(id) {
  const result = await query('SELECT * FROM menu_items WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function updateMenuItem(id, restaurantId, data) {
  const result = await query(
    `UPDATE menu_items SET
       name = COALESCE($1, name), description = COALESCE($2, description),
       price = COALESCE($3, price), category = COALESCE($4, category),
       availability = COALESCE($5, availability), updated_at = NOW()
     WHERE id = $6 AND restaurant_id = $7 RETURNING *`,
    [data.name, data.description, data.price, data.category, data.availability, id, restaurantId]
  );
  if (result.rows[0]) {
    await cacheDel(REDIS_KEYS.RESTAURANT_MENU(restaurantId));
  }
  return result.rows[0];
}

async function deleteMenuItem(id, restaurantId) {
  const result = await query(
    'DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2 RETURNING id',
    [id, restaurantId]
  );
  if (result.rows[0]) {
    await cacheDel(REDIS_KEYS.RESTAURANT_MENU(restaurantId));
  }
  return result.rows[0];
}

async function getMenuItemsByIds(ids) {
  const result = await query(
    'SELECT * FROM menu_items WHERE id = ANY($1) AND availability = true',
    [ids]
  );
  return result.rows;
}

module.exports = {
  createMenuItem,
  getMenuByRestaurant,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
  getMenuItemsByIds,
};
