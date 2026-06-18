const { Router } = require('express');
const { body, param } = require('express-validator');
const { validate, authenticate, asyncHandler, successResponse } = require('@foodflow/shared');
const userService = require('../services/user.service');

const router = Router();

router.use(authenticate);

router.get('/profile', asyncHandler(async (req, res) => {
  const profile = await userService.getProfile(req.user.id);
  if (!profile) return res.status(404).json({ success: false, message: 'User not found' });
  return successResponse(res, profile);
}));

router.put('/profile',
  [body('name').optional().trim().notEmpty(), body('email').optional().isEmail()],
  validate,
  asyncHandler(async (req, res) => {
    const profile = await userService.updateProfile(req.user.id, req.body);
    return successResponse(res, profile, 'Profile updated');
  })
);

router.get('/addresses', asyncHandler(async (req, res) => {
  const addresses = await userService.getAddresses(req.user.id);
  return successResponse(res, addresses);
}));

router.post('/addresses',
  [
    body('address_line').notEmpty(),
    body('city').notEmpty(),
    body('state').notEmpty(),
    body('pincode').notEmpty(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const address = await userService.addAddress(req.user.id, req.body);
    return successResponse(res, address, 'Address added', 201);
  })
);

router.put('/addresses/:id',
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const address = await userService.updateAddress(req.user.id, req.params.id, req.body);
    if (!address) return res.status(404).json({ success: false, message: 'Address not found' });
    return successResponse(res, address, 'Address updated');
  })
);

router.delete('/addresses/:id',
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const deleted = await userService.deleteAddress(req.user.id, req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Address not found' });
    return successResponse(res, null, 'Address deleted');
  })
);

router.get('/orders', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await userService.getOrderHistory(req.user.id, page, limit);
  return successResponse(res, result);
}));

module.exports = router;
