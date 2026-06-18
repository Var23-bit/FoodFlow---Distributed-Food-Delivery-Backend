const { Router } = require('express');
const { body, param } = require('express-validator');
const { validate, authenticate, authorize, asyncHandler, successResponse, ROLES } = require('@foodflow/shared');
const menuService = require('../services/menu.service');
const restaurantService = require('../services/restaurant.service');

const router = Router();

router.get('/restaurant/:restaurantId',
  [param('restaurantId').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const menu = await menuService.getMenuByRestaurant(req.params.restaurantId);
    return successResponse(res, menu);
  })
);

router.get('/:id',
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const item = await menuService.getMenuItemById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
    return successResponse(res, item);
  })
);

router.post('/',
  authenticate,
  authorize(ROLES.RESTAURANT_OWNER, ROLES.ADMIN),
  [
    body('restaurantId').isUUID(),
    body('name').notEmpty(),
    body('price').isFloat({ min: 0 }),
    body('category').notEmpty(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const restaurants = await restaurantService.getRestaurantByOwner(req.user.id);
    const owns = restaurants.some((r) => r.id === req.body.restaurantId) || req.user.role === ROLES.ADMIN;
    if (!owns) return res.status(403).json({ success: false, message: 'Not authorized for this restaurant' });

    const item = await menuService.createMenuItem(req.body.restaurantId, req.body);
    return successResponse(res, item, 'Menu item created', 201);
  })
);

router.put('/:id',
  authenticate,
  authorize(ROLES.RESTAURANT_OWNER, ROLES.ADMIN),
  [param('id').isUUID(), body('restaurantId').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const item = await menuService.updateMenuItem(req.params.id, req.body.restaurantId, req.body);
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
    return successResponse(res, item, 'Menu item updated');
  })
);

router.delete('/:id',
  authenticate,
  authorize(ROLES.RESTAURANT_OWNER, ROLES.ADMIN),
  [param('id').isUUID(), body('restaurantId').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const deleted = await menuService.deleteMenuItem(req.params.id, req.body.restaurantId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Menu item not found' });
    return successResponse(res, null, 'Menu item deleted');
  })
);

module.exports = router;
