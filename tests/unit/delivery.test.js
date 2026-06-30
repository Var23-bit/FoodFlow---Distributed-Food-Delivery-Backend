const { autoAssignPartner, updateDeliveryStatus } = require('../../services/delivery-service/src/services/delivery.service');
const { query, publishEvent, KAFKA_TOPICS, DELIVERY_STATUS } = require('@foodflow/shared');

jest.mock('@foodflow/shared', () => ({
  query: jest.fn(),
  publishEvent: jest.fn(),
  KAFKA_TOPICS: { DELIVERY_ASSIGNED: 'DELIVERY_ASSIGNED', DELIVERY_STATUS_UPDATED: 'DELIVERY_STATUS_UPDATED', ORDER_DELIVERED: 'ORDER_DELIVERED' },
  DELIVERY_STATUS: { PENDING: 'PENDING', ASSIGNED: 'ASSIGNED', ACCEPTED: 'ACCEPTED', IN_TRANSIT: 'IN_TRANSIT', DELIVERED: 'DELIVERED' }
}));

describe('Delivery Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('autoAssignPartner', () => {
    it('should assign a partner if available', async () => {
      // Mock order query
      query.mockResolvedValueOnce({ rows: [{ id: 'ord_1', pickup_address: '123 St', address_line: '456 Ave', city: 'City', state: 'State', pincode: '12345' }] });
      // Mock createDelivery
      query.mockResolvedValueOnce({ rows: [{ id: 'del_1', order_id: 'ord_1', status: 'PENDING' }] });
      // Mock partner query
      query.mockResolvedValueOnce({ rows: [{ id: 'partner_1' }] });
      // Mock assignDeliveryPartner
      query.mockResolvedValueOnce({ rows: [{ id: 'del_1', order_id: 'ord_1', delivery_partner_id: 'partner_1', status: 'ASSIGNED' }] });

      const result = await autoAssignPartner('ord_1');
      expect(result.delivery_partner_id).toBe('partner_1');
      expect(publishEvent).toHaveBeenCalledWith(KAFKA_TOPICS.DELIVERY_ASSIGNED, expect.any(Object));
    });

    it('should return null if no order found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await autoAssignPartner('ord_1');
      expect(result).toBeNull();
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should update status and publish events', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 'del_1', order_id: 'ord_1', delivery_partner_id: 'partner_1', status: 'IN_TRANSIT' }]
      });

      const result = await updateDeliveryStatus('del_1', 'partner_1', 'IN_TRANSIT');
      expect(result.status).toBe('IN_TRANSIT');
      expect(publishEvent).toHaveBeenCalledWith(KAFKA_TOPICS.DELIVERY_STATUS_UPDATED, expect.any(Object));
    });

    it('should also publish ORDER_DELIVERED when status is DELIVERED', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 'del_1', order_id: 'ord_1', delivery_partner_id: 'partner_1', status: 'DELIVERED' }]
      });

      await updateDeliveryStatus('del_1', 'partner_1', 'DELIVERED');
      expect(publishEvent).toHaveBeenCalledWith(KAFKA_TOPICS.DELIVERY_STATUS_UPDATED, expect.any(Object));
      expect(publishEvent).toHaveBeenCalledWith(KAFKA_TOPICS.ORDER_DELIVERED, expect.any(Object));
    });
  });
});
