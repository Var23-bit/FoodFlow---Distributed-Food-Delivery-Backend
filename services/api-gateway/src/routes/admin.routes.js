const { Router } = require('express');
const { query } = require('@foodflow/shared');
const { authenticate, authorize, asyncHandler, successResponse, ROLES } = require('@foodflow/shared');

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.ADMIN));

router.get('/users', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role } = req.query;
  const offset = (page - 1) * limit;
  let queryText = 'SELECT id, name, email, role, created_at FROM users';
  const params = [];

  if (role) {
    params.push(role);
    queryText += ` WHERE role = $${params.length}`;
  }

  params.push(limit, offset);
  queryText += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const result = await query(queryText, params);
  const countResult = await query('SELECT COUNT(*) FROM users');
  return successResponse(res, {
    users: result.rows,
    total: parseInt(countResult.rows[0].count, 10),
  });
}));

router.get('/restaurants', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT r.*, u.name as owner_name, u.email as owner_email
     FROM restaurants r JOIN users u ON r.owner_id = u.id ORDER BY r.created_at DESC`
  );
  return successResponse(res, result.rows);
}));

router.get('/analytics', asyncHandler(async (req, res) => {
  const [users, restaurants, orders, deliveries, revenue] = await Promise.all([
    query('SELECT role, COUNT(*) as count FROM users GROUP BY role'),
    query('SELECT COUNT(*) as count FROM restaurants'),
    query('SELECT status, COUNT(*) as count FROM orders GROUP BY status'),
    query('SELECT status, COUNT(*) as count FROM deliveries GROUP BY status'),
    query("SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status = 'DELIVERED'"),
  ]);

  return successResponse(res, {
    usersByRole: users.rows,
    totalRestaurants: parseInt(restaurants.rows[0].count, 10),
    ordersByStatus: orders.rows,
    deliveriesByStatus: deliveries.rows,
    totalRevenue: parseFloat(revenue.rows[0].total),
  });
}));

router.patch('/users/:id/role', asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!Object.values(ROLES).includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }
  const result = await query(
    'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role',
    [role, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found' });
  return successResponse(res, result.rows[0], 'Role updated');
}));

router.patch('/restaurants/:id/toggle', asyncHandler(async (req, res) => {
  const result = await query(
    'UPDATE restaurants SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Restaurant not found' });
  return successResponse(res, result.rows[0], 'Restaurant status toggled');
}));

module.exports = router;
