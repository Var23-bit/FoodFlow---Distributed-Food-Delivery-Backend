const { Router } = require('express');
const { body, param, query: queryValidator } = require('express-validator');
const {
  validate, authenticate, authorize, optionalAuth, asyncHandler, successResponse, ROLES,
} = require('@foodflow/shared');
const restaurantService = require('../services/restaurant.service');
const orderConsumer = require('../consumers/order.consumer');

const router = Router();

router.get('/',
  optionalAuth,
  [queryValidator('search').optional(), queryValidator('page').optional().isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const result = await restaurantService.getRestaurants(req.query);
    return successResponse(res, result);
  })
);

router.get('/popular', asyncHandler(async (req, res) => {
  const restaurants = await restaurantService.getPopularRestaurants();
  return successResponse(res, restaurants);
}));

router.get('/my', authenticate, authorize(ROLES.RESTAURANT_OWNER),
  asyncHandler(async (req, res) => {
    const restaurants = await restaurantService.getRestaurantByOwner(req.user.id);
    return successResponse(res, restaurants);
  })
);

router.get('/:id',
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const restaurant = await restaurantService.getRestaurantById(req.params.id);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    return successResponse(res, restaurant);
  })
);

router.post('/',
  authenticate,
  authorize(ROLES.RESTAURANT_OWNER, ROLES.ADMIN),
  [body('name').notEmpty(), body('address').notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const restaurant = await restaurantService.createRestaurant(req.user.id, req.body);
    return successResponse(res, restaurant, 'Restaurant created', 201);
  })
);

router.put('/:id',
  authenticate,
  authorize(ROLES.RESTAURANT_OWNER, ROLES.ADMIN),
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const restaurant = await restaurantService.updateRestaurant(req.params.id, req.user.id, req.body);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    return successResponse(res, restaurant, 'Restaurant updated');
  })
);

router.delete('/:id',
  authenticate,
  authorize(ROLES.RESTAURANT_OWNER, ROLES.ADMIN),
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const deleted = await restaurantService.deleteRestaurant(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    return successResponse(res, null, 'Restaurant deleted');
  })
);

router.get('/:id/orders',
  authenticate,
  authorize(ROLES.RESTAURANT_OWNER),
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const orders = await orderConsumer.getRestaurantOrders(req.params.id, req.query.status);
    return successResponse(res, orders);
  })
);

router.patch('/:restaurantId/orders/:orderId/accept',
  authenticate,
  authorize(ROLES.RESTAURANT_OWNER),
  asyncHandler(async (req, res) => {
    const order = await orderConsumer.acceptOrder(req.params.orderId, req.params.restaurantId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found or already processed' });
    return successResponse(res, order, 'Order accepted');
  })
);

router.patch('/:restaurantId/orders/:orderId/reject',
  authenticate,
  authorize(ROLES.RESTAURANT_OWNER),
  asyncHandler(async (req, res) => {
    const order = await orderConsumer.rejectOrder(req.params.orderId, req.params.restaurantId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found or already processed' });
    return successResponse(res, order, 'Order rejected');
  })
);

router.patch('/:restaurantId/orders/:orderId/status',
  authenticate,
  authorize(ROLES.RESTAURANT_OWNER),
  [body('status').isIn(['PREPARING', 'READY_FOR_PICKUP'])],
  validate,
  asyncHandler(async (req, res) => {
    const order = await orderConsumer.updateOrderStatus(req.params.orderId, req.params.restaurantId, req.body.status);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    return successResponse(res, order, 'Order status updated');
  })
);

module.exports = router;
