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
    orders: { create: jest.fn().mockResolvedValue({ id: 'rzp_order_123' }) },
  }));
});

describe('Payment Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentOrder', () => {
    it('should create razorpay order and save to db', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 'pay_123', amount: 500, currency: 'INR', razorpay_order_id: 'rzp_order_123', status: 'PENDING' }]
      });

      const result = await createPaymentOrder('user_1', { orderId: 'ord_1', amount: 500 });
      expect(result.provider).toBe('RAZORPAY');
      expect(result.razorpayOrderId).toBe('rzp_order_123');
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifyPayment', () => {
    it('should verify valid signature and publish SUCCESS', async () => {
      const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret';
      const rzpOrderId = 'rzp_order_123';
      const rzpPaymentId = 'rzp_pay_123';
      const signature = crypto.createHmac('sha256', secret).update(`${rzpOrderId}|${rzpPaymentId}`).digest('hex');

      query.mockResolvedValueOnce({
        rows: [{ id: 'pay_1', order_id: 'ord_1', amount: 500 }]
      });

      await verifyPayment({
        paymentId: 'pay_1',
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        razorpaySignature: signature
      });

      expect(query).toHaveBeenCalled();
      expect(publishEvent).toHaveBeenCalledWith(KAFKA_TOPICS.PAYMENT_SUCCESSFUL, expect.any(Object));
    });

    it('should fail with invalid signature and publish FAILED', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 'pay_1', order_id: 'ord_1', amount: 500 }]
      });

      await verifyPayment({
        paymentId: 'pay_1',
        razorpayOrderId: 'rzp_order_123',
        razorpayPaymentId: 'rzp_pay_123',
        razorpaySignature: 'invalid_sig'
      });

      expect(query).toHaveBeenCalled();
      expect(publishEvent).toHaveBeenCalledWith(KAFKA_TOPICS.PAYMENT_FAILED, expect.any(Object));
    });
  });
});
