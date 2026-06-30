const { Router } = require('express');
const { body, param } = require('express-validator');
const { validate, authenticate, authorize, asyncHandler, successResponse, ROLES } = require('@foodflow/shared');
const orderService = require('../services/order.service');

const router = Router();

router.use(authenticate);

router.post('/',
  authorize(ROLES.CUSTOMER),
  [
    body('restaurantId').isUUID(),
    body('items').isArray({ min: 1 }),
    body('items.*.menuItemId').isUUID(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('deliveryAddressId').optional().isUUID(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const order = await orderService.placeOrder(req.user.id, req.body);
    return successResponse(res, order, 'Order placed successfully', 201);
  })
);

router.get('/',
  asyncHandler(async (req, res) => {
    const orders = await orderService.getOrdersByCustomer(req.user.id);
    return successResponse(res, orders);
  })
);

router.get('/:id',
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrderById(req.params.id, req.user.id, req.user.role);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    return successResponse(res, order);
  })
);

router.patch('/:id/cancel',
  authorize(ROLES.CUSTOMER),
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const order = await orderService.cancelOrder(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order cannot be cancelled' });
    return successResponse(res, order, 'Order cancelled');
  })
);

router.patch('/:id/status',
  authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER),
  [param('id').isUUID(), body('status').notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    // Ideally we should verify the restaurant owner owns the restaurant for this order
    const order = await orderService.updateOrderStatus(req.params.id, req.body.status);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    return successResponse(res, order, 'Order status updated');
  })
);

module.exports = router;
