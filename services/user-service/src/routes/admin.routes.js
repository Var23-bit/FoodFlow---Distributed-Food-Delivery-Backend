const { Router } = require('express');
const { body, query: queryValidator } = require('express-validator');
const { validate, authenticate, authorize, asyncHandler, successResponse, ROLES, query } = require('@foodflow/shared');

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.ADMIN));

router.get('/users',
  [
    queryValidator('page').optional().isInt({ min: 1 }).toInt(),
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  validate,
  asyncHandler(async (req, res) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const offset = (page - 1) * limit;

    const countResult = await query('SELECT COUNT(*) FROM users');
    const result = await query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    
    return successResponse(res, {
      users: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  })
);

router.get('/restaurants',
  asyncHandler(async (req, res) => {
    const result = await query(`
      SELECT r.*, u.name as owner_name, u.email as owner_email 
      FROM restaurants r 
      JOIN users u ON r.owner_id = u.id 
      ORDER BY r.created_at DESC
    `);
    return successResponse(res, result.rows);
  })
);

router.get('/analytics',
  asyncHandler(async (req, res) => {
    const usersResult = await query('SELECT COUNT(*) FROM users');
    const ordersResult = await query('SELECT COUNT(*) FROM orders');
    const revenueResult = await query("SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status = 'DELIVERED'");
    const restaurantsResult = await query('SELECT COUNT(*) FROM restaurants');
    const statusResult = await query('SELECT status, COUNT(*) FROM orders GROUP BY status');
    
    const recentOrdersResult = await query(`
      SELECT o.id, o.status, o.total_amount, o.created_at, u.name as customer_name, r.name as restaurant_name 
      FROM orders o 
      JOIN users u ON o.customer_id = u.id 
      JOIN restaurants r ON o.restaurant_id = r.id 
      ORDER BY o.created_at DESC LIMIT 10
    `);

    const analytics = {
      totalUsers: parseInt(usersResult.rows[0].count),
      totalOrders: parseInt(ordersResult.rows[0].count),
      totalRevenue: parseFloat(revenueResult.rows[0].total),
      totalRestaurants: parseInt(restaurantsResult.rows[0].count),
      ordersByStatus: statusResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      recentOrders: recentOrdersResult.rows
    };

    return successResponse(res, analytics);
  })
);

router.patch('/users/:id/role',
  [
    body('role').isIn(Object.values(ROLES))
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    
    const result = await query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role', [role, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    return successResponse(res, result.rows[0], 'User role updated successfully');
  })
);

module.exports = router;
