const crypto = require('crypto');
const Razorpay = require('razorpay');
const { query, publishEvent, KAFKA_TOPICS } = require('@foodflow/shared');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret',
});

async function createPaymentOrder(userId, { orderId, amount, currency = 'INR' }) {
  const amountInPaise = Math.round(amount * 100);
  const options = {
    amount: amountInPaise,
    currency: currency,
    receipt: `receipt_${orderId}`,
  };

  let razorpayOrder;
  try {
    razorpayOrder = await razorpay.orders.create(options);
  } catch (error) {
    throw Object.assign(new Error('Razorpay order creation failed'), { status: 500, details: error });
  }

  const result = await query(
    `INSERT INTO payments (order_id, razorpay_order_id, amount, currency, status, payment_method)
     VALUES ($1, $2, $3, $4, 'PENDING', 'RAZORPAY')
     RETURNING *`,
    [orderId, razorpayOrder.id, amount, currency]
  );

  const payment = result.rows[0];
  return {
    paymentId: payment.id,
    orderId,
    userId,
    amount: payment.amount,
    currency,
    provider: 'RAZORPAY',
    razorpayOrderId: payment.razorpay_order_id,
    status: payment.status,
  };
}

async function verifyPayment({ paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret';
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const isValid = secret && expectedSignature === razorpaySignature;
  const status = isValid ? 'SUCCESS' : 'FAILED';

  const result = await query(
    `UPDATE payments
     SET razorpay_order_id = $1, razorpay_payment_id = $2, razorpay_signature = $3, status = $4, updated_at = CURRENT_TIMESTAMP
     WHERE id = $5
     RETURNING *`,
    [razorpayOrderId, razorpayPaymentId, razorpaySignature, status, paymentId]
  );

  if (!result.rows.length) {
    throw Object.assign(new Error('Payment not found'), { status: 404 });
  }

  const payment = result.rows[0];
  await publishEvent(isValid ? KAFKA_TOPICS.PAYMENT_SUCCESSFUL : KAFKA_TOPICS.PAYMENT_FAILED, payment);
  return payment;
}

async function refundPayment(paymentId) {
  // We need to fetch the payment to get the razorpay_payment_id
  const paymentResult = await query(`SELECT razorpay_payment_id, amount FROM payments WHERE id = $1`, [paymentId]);
  if (!paymentResult.rows.length) {
    throw Object.assign(new Error('Payment not found'), { status: 404 });
  }

  const payment = paymentResult.rows[0];
  if (payment.razorpay_payment_id) {
    try {
      await razorpay.payments.refund(payment.razorpay_payment_id, {
        amount: Math.round(payment.amount * 100),
      });
    } catch (error) {
       console.error('Razorpay refund error:', error);
       throw Object.assign(new Error('Razorpay refund failed'), { status: 500, details: error });
    }
  }

  const result = await query(
    `UPDATE payments
     SET status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [paymentId]
  );

  return result.rows[0];
}

module.exports = { createPaymentOrder, verifyPayment, refundPayment };
