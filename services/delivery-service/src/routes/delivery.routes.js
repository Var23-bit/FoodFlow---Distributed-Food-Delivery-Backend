const { Router } = require('express');
const { body, param } = require('express-validator');
const { validate, authenticate, authorize, asyncHandler, successResponse, ROLES } = require('@foodflow/shared');
const deliveryService = require('../services/delivery.service');

const router = Router();

router.use(authenticate);

router.get('/',
  authorize(ROLES.DELIVERY_PARTNER),
  asyncHandler(async (req, res) => {
    const deliveries = await deliveryService.getDeliveriesByPartner(req.user.id, req.query.status);
    return successResponse(res, deliveries);
  })
);

router.get('/available',
  authorize(ROLES.DELIVERY_PARTNER),
  asyncHandler(async (req, res) => {
    const deliveries = await deliveryService.getAvailableDeliveries();
    return successResponse(res, deliveries);
  })
);

router.get('/:id',
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const delivery = await deliveryService.getDeliveryById(req.params.id);
    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });
    return successResponse(res, delivery);
  })
);

router.patch('/:id/accept',
  authorize(ROLES.DELIVERY_PARTNER),
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const delivery = await deliveryService.acceptDelivery(req.params.id, req.user.id);
    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not available' });
    return successResponse(res, delivery, 'Delivery accepted');
  })
);

router.patch('/:id/status',
  authorize(ROLES.DELIVERY_PARTNER),
  [
    param('id').isUUID(),
    body('status').isIn(['PICKED_UP', 'IN_TRANSIT', 'DELIVERED']),
    body('location').optional().isObject(),
    body('location.latitude').optional().isFloat(),
    body('location.longitude').optional().isFloat(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const delivery = await deliveryService.updateDeliveryStatus(
      req.params.id,
      req.user.id,
      req.body.status,
      req.body.location
    );
    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });
    return successResponse(res, delivery, 'Delivery status updated');
  })
);

router.patch('/:id/assign',
  authorize(ROLES.ADMIN),
  [param('id').isUUID(), body('partnerId').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const delivery = await deliveryService.assignDeliveryPartner(req.params.id, req.body.partnerId);
    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });
    return successResponse(res, delivery, 'Partner assigned');
  })
);

module.exports = router;
