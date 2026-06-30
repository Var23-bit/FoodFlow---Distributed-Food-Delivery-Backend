const { handlePaymentEvents } = require('../../services/order-service/src/consumers/payment.consumer');
const { handleDeliveryEvents } = require('../../services/order-service/src/consumers/delivery.consumer');
const orderService = require('../../services/order-service/src/services/order.service');
const { publishEvent, KAFKA_TOPICS, ORDER_STATUS } = require('@foodflow/shared');

jest.mock('../../services/order-service/src/services/order.service', () => ({
  updateOrderStatus: jest.fn(),
  assignDeliveryPartner: jest.fn(),
}));

jest.mock('@foodflow/shared', () => ({
  publishEvent: jest.fn(),
  KAFKA_TOPICS: {
    PAYMENT_SUCCESSFUL: 'payment_successful',
    PAYMENT_FAILED: 'payment_failed',
    ORDER_CONFIRMED: 'order_confirmed',
    ORDER_CANCELLED: 'order_cancelled',
    DELIVERY_ASSIGNED: 'delivery_assigned',
    DELIVERY_STATUS_UPDATED: 'delivery_status_updated',
  },
  ORDER_STATUS: {
    CONFIRMED: 'CONFIRMED',
    CANCELLED: 'CANCELLED',
    PICKED_UP: 'PICKED_UP',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
  },
}));

describe('Order Service Consumers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('payment.consumer - handlePaymentEvents', () => {
    it('should confirm order on successful payment', async () => {
      const message = { order_id: 'ord_123' };
      orderService.updateOrderStatus.mockResolvedValueOnce({
        id: 'ord_123',
        customer_id: 'cust_1',
        restaurant_id: 'rest_1',
        status: ORDER_STATUS.CONFIRMED,
        total_amount: 100,
      });

      await handlePaymentEvents(KAFKA_TOPICS.PAYMENT_SUCCESSFUL, message);

      expect(orderService.updateOrderStatus).toHaveBeenCalledWith('ord_123', ORDER_STATUS.CONFIRMED);
      expect(publishEvent).toHaveBeenCalledWith(KAFKA_TOPICS.ORDER_CONFIRMED, {
        orderId: 'ord_123',
        customerId: 'cust_1',
        restaurantId: 'rest_1',
        status: ORDER_STATUS.CONFIRMED,
        totalAmount: 100,
      });
    });

    it('should cancel order on failed payment', async () => {
      const message = { order_id: 'ord_123' };
      orderService.updateOrderStatus.mockResolvedValueOnce({
        id: 'ord_123',
        customer_id: 'cust_1',
        status: ORDER_STATUS.CANCELLED,
      });

      await handlePaymentEvents(KAFKA_TOPICS.PAYMENT_FAILED, message);

      expect(orderService.updateOrderStatus).toHaveBeenCalledWith('ord_123', ORDER_STATUS.CANCELLED);
      expect(publishEvent).toHaveBeenCalledWith(KAFKA_TOPICS.ORDER_CANCELLED, {
        orderId: 'ord_123',
        customerId: 'cust_1',
        reason: 'Payment failed',
      });
    });
  });

  describe('delivery.consumer - handleDeliveryEvents', () => {
    it('should update delivery partner without changing status when delivery is assigned', async () => {
      const message = { orderId: 'ord_123', deliveryPartnerId: 'partner_1' };

      await handleDeliveryEvents(KAFKA_TOPICS.DELIVERY_ASSIGNED, message);

      expect(orderService.assignDeliveryPartner).toHaveBeenCalledWith('ord_123', 'partner_1');
      expect(orderService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('should update order status to PICKED_UP when delivery is picked up', async () => {
      const message = { orderId: 'ord_123', status: 'PICKED_UP' };

      await handleDeliveryEvents(KAFKA_TOPICS.DELIVERY_STATUS_UPDATED, message);

      expect(orderService.updateOrderStatus).toHaveBeenCalledWith('ord_123', ORDER_STATUS.PICKED_UP);
    });

    it('should update order status to OUT_FOR_DELIVERY when delivery is in transit', async () => {
      const message = { orderId: 'ord_123', status: 'IN_TRANSIT' };

      await handleDeliveryEvents(KAFKA_TOPICS.DELIVERY_STATUS_UPDATED, message);

      expect(orderService.updateOrderStatus).toHaveBeenCalledWith('ord_123', ORDER_STATUS.OUT_FOR_DELIVERY);
    });

    it('should update order status to DELIVERED when delivery is completed', async () => {
      const message = { orderId: 'ord_123', status: 'DELIVERED' };

      await handleDeliveryEvents(KAFKA_TOPICS.DELIVERY_STATUS_UPDATED, message);

      expect(orderService.updateOrderStatus).toHaveBeenCalledWith('ord_123', ORDER_STATUS.DELIVERED);
    });
  });
});
