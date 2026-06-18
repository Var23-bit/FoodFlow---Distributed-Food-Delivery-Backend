const { Router } = require('express');
const { body, param } = require('express-validator');
const { validate, authenticate, asyncHandler, successResponse } = require('@foodflow/shared');
const cartService = require('../services/cart.service');

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user.id);
  return successResponse(res, cart);
}));

router.post('/items',
  [
    body('menuItemId').isUUID(),
    body('restaurantId').isUUID(),
    body('name').notEmpty(),
    body('price').isFloat({ min: 0 }),
    body('quantity').isInt({ min: 1 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const cart = await cartService.addItem(req.user.id, req.body);
    return successResponse(res, cart, 'Item added to cart', 201);
  })
);

router.delete('/items/:id',
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const cart = await cartService.removeItem(req.user.id, req.params.id);
    return successResponse(res, cart, 'Item removed');
  })
);

router.patch('/items/:id',
  [param('id').isUUID(), body('quantity').isInt({ min: 0 })],
  validate,
  asyncHandler(async (req, res) => {
    const cart = await cartService.updateItemQuantity(req.user.id, req.params.id, req.body.quantity);
    return successResponse(res, cart, 'Cart updated');
  })
);

router.delete('/', asyncHandler(async (req, res) => {
  const cart = await cartService.clearCart(req.user.id);
  return successResponse(res, cart, 'Cart cleared');
}));

module.exports = router;
