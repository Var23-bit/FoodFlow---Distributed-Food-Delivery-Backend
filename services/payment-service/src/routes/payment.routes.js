const { Router } = require('express');
const { body, param } = require('express-validator');
const { validate, authenticate, asyncHandler, successResponse, query, publishEvent, KAFKA_TOPICS } = require('@foodflow/shared');
const crypto = require('crypto');
const paymentService = require('../services/payment.service');

const router = Router();

router.post('/webhook', asyncHandler(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_webhook_secret';
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest('hex');

  if (digest === req.headers['x-razorpay-signature']) {
    const event = req.body.event;
    if (event === 'payment.captured') {
        const payment = req.body.payload.payment.entity;
        // We could look up our payment ID and update status here, but normally
        // verifyPayment handles the frontend success. Webhook is a fallback.
        console.log('Webhook: Payment captured', payment.id);
    }
    return res.json({ status: 'ok' });
  } else {
    return res.status(400).send('Invalid signature');
  }
}));

router.use(authenticate);

router.post('/create-order',
  [body('orderId').isUUID(), body('amount').isFloat({ min: 1 }), body('currency').optional().isString()],
  validate,
  asyncHandler(async (req, res) => {
    const paymentOrder = await paymentService.createPaymentOrder(req.user.id, req.body);
    return successResponse(res, paymentOrder, 'Payment order created', 201);
  })
);

router.post('/verify',
  [
    body('paymentId').isUUID(),
    body('razorpayOrderId').notEmpty(),
    body('razorpayPaymentId').notEmpty(),
    body('razorpaySignature').notEmpty(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const payment = await paymentService.verifyPayment(req.body);
    return successResponse(res, payment, 'Payment verified');
  })
);

router.post('/:id/refund',
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const refund = await paymentService.refundPayment(req.params.id);
    return successResponse(res, refund, 'Refund processed');
  })
);

module.exports = router;
