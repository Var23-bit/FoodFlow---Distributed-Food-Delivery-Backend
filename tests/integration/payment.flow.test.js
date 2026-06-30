const { createPaymentOrder, verifyPayment } = require('../../services/payment-service/src/services/payment.service');
const { query, publishEvent, KAFKA_TOPICS } = require('@foodflow/shared');
const crypto = require('crypto');

jest.mock('@foodflow/shared', () => ({
  query: jest.fn(),
  publishEvent: jest.fn(),
  KAFKA_TOPICS: { PAYMENT_SUCCESSFUL: 'PAYMENT_SUCCESSFUL', PAYMENT_FAILED: 'PAYMENT_FAILED' }
}));

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: { create: jest.fn().mockResolvedValue({ id: 'rzp_order_integration' }) },
  }));
});

describe('Payment Flow Integration Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should complete full payment flow successfully', async () => {
    // 1. Create order
    query.mockResolvedValueOnce({
      rows: [{ id: 'pay_int', amount: 1000, currency: 'INR', razorpay_order_id: 'rzp_order_integration', status: 'PENDING' }]
    });

    const paymentResult = await createPaymentOrder('user_1', { orderId: 'ord_1', amount: 1000 });
    expect(paymentResult.razorpayOrderId).toBe('rzp_order_integration');

    // 2. Verify with valid signature
    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret';
    const rzpPaymentId = 'rzp_pay_integration';
    const signature = crypto.createHmac('sha256', secret).update(`${paymentResult.razorpayOrderId}|${rzpPaymentId}`).digest('hex');

    query.mockResolvedValueOnce({
      rows: [{ id: 'pay_int', order_id: 'ord_1', amount: 1000, status: 'SUCCESS' }]
    });

    await verifyPayment({
      paymentId: paymentResult.paymentId,
      razorpayOrderId: paymentResult.razorpayOrderId,
      razorpayPaymentId: rzpPaymentId,
      razorpaySignature: signature
    });

    expect(publishEvent).toHaveBeenCalledWith(KAFKA_TOPICS.PAYMENT_SUCCESSFUL, expect.objectContaining({ status: 'SUCCESS' }));
  });
});
