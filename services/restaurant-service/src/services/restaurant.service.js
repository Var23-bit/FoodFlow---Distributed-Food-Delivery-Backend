const {
  query,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  REDIS_KEYS,
  CACHE_TTL,
  paginationMeta,
} = require('@foodflow/shared');

async function createRestaurant(ownerId, data) {
  const result = await query(
    `INSERT INTO restaurants (owner_id, name, description, address)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [ownerId, data.name, data.description, data.address]
  );
  await cacheDel(REDIS_KEYS.POPULAR_RESTAURANTS);
  return result.rows[0];
}

async function getRestaurants({ search, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  let whereClause = 'WHERE is_active = true';
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
  }

  const countResult = await query(`SELECT COUNT(*) FROM restaurants ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const result = await query(
    `SELECT * FROM restaurants ${whereClause} ORDER BY rating DESC, created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { restaurants: result.rows, pagination: paginationMeta(total, page, limit) };
}

async function getPopularRestaurants() {
  const cached = await cacheGet(REDIS_KEYS.POPULAR_RESTAURANTS);
  if (cached) return cached;

  const result = await query(
    'SELECT * FROM restaurants WHERE is_active = true ORDER BY rating DESC LIMIT 10'
  );
  await cacheSet(REDIS_KEYS.POPULAR_RESTAURANTS, result.rows, CACHE_TTL.POPULAR);
  return result.rows;
}

async function getRestaurantById(id) {
  const cached = await cacheGet(REDIS_KEYS.RESTAURANT(id));
  if (cached) return cached;

  const result = await query('SELECT * FROM restaurants WHERE id = $1', [id]);
  if (result.rows[0]) {
    await cacheSet(REDIS_KEYS.RESTAURANT(id), result.rows[0], CACHE_TTL.RESTAURANT);
  }
  return result.rows[0] || null;
}

async function updateRestaurant(id, ownerId, data) {
  const result = await query(
    `UPDATE restaurants SET
       name = COALESCE($1, name), description = COALESCE($2, description),
       address = COALESCE($3, address), is_active = COALESCE($4, is_active), updated_at = NOW()
     WHERE id = $5 AND owner_id = $6 RETURNING *`,
    [data.name, data.description, data.address, data.is_active, id, ownerId]
  );
  if (result.rows[0]) {
    await cacheDel(REDIS_KEYS.RESTAURANT(id));
    await cacheDel(REDIS_KEYS.POPULAR_RESTAURANTS);
  }
  return result.rows[0];
}

async function deleteRestaurant(id, ownerId) {
  const result = await query(
    'DELETE FROM restaurants WHERE id = $1 AND owner_id = $2 RETURNING id',
    [id, ownerId]
  );
  if (result.rows[0]) {
    await cacheDel(REDIS_KEYS.RESTAURANT(id));
    await cacheDelPattern(`restaurant:${id}*`);
    await cacheDel(REDIS_KEYS.POPULAR_RESTAURANTS);
  }
  return result.rows[0];
}

async function getRestaurantByOwner(ownerId) {
  const result = await query('SELECT * FROM restaurants WHERE owner_id = $1', [ownerId]);
  return result.rows;
}

module.exports = {
  createRestaurant,
  getRestaurants,
  getPopularRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant,
  getRestaurantByOwner,
};
