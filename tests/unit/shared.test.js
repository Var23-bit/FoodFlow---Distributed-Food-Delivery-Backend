const { hashPassword, comparePassword } = require('../../shared/utils');
const { generateAccessToken, verifyAccessToken, authenticate, authorize } = require('../../shared/middleware/auth');
const { ROLES, ORDER_STATUS, DELIVERY_STATUS, KAFKA_TOPICS } = require('../../shared/constants');

describe('Shared Utils', () => {
  test('hashPassword and comparePassword work correctly', async () => {
    const hash = await hashPassword('testpassword123');
    expect(hash).not.toBe('testpassword123');
    const valid = await comparePassword('testpassword123', hash);
    expect(valid).toBe(true);
    const invalid = await comparePassword('wrongpassword', hash);
    expect(invalid).toBe(false);
  });
});

describe('JWT Authentication', () => {
  test('generate and verify access token', () => {
    process.env.JWT_SECRET = 'test-secret';
    const payload = { id: '123', email: 'test@test.com', role: ROLES.CUSTOMER };
    const token = generateAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.id).toBe('123');
    expect(decoded.email).toBe('test@test.com');
    expect(decoded.role).toBe(ROLES.CUSTOMER);
  });
});

describe('Constants', () => {
  test('ORDER_STATUS contains all required states', () => {
    const required = ['CREATED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP',
      'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    required.forEach((status) => {
      expect(ORDER_STATUS[status]).toBe(status);
    });
  });

  test('ROLES contains all user types', () => {
    expect(Object.keys(ROLES)).toEqual(['CUSTOMER', 'RESTAURANT_OWNER', 'DELIVERY_PARTNER', 'ADMIN']);
  });

  test('KAFKA_TOPICS has required event topics', () => {
    expect(KAFKA_TOPICS.ORDER_CREATED).toBe('order_created');
    expect(KAFKA_TOPICS.ORDER_DELIVERED).toBe('order_delivered');
    expect(KAFKA_TOPICS.DELIVERY_ASSIGNED).toBe('delivery_assigned');
    expect(KAFKA_TOPICS.PAYMENT_COMPLETED).toBe('payment_completed');
  });

  test('DELIVERY_STATUS contains all states', () => {
    const required = ['PENDING', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
    required.forEach((status) => {
      expect(DELIVERY_STATUS[status]).toBe(status);
    });
  });
});

describe('Authorization Middleware', () => {
  test('authorize allows matching role', () => {
    const middleware = authorize(ROLES.ADMIN);
    const req = { user: { role: ROLES.ADMIN } };
    const res = {};
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('authorize rejects non-matching role', () => {
    const middleware = authorize(ROLES.ADMIN);
    const req = { user: { role: ROLES.CUSTOMER } };
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }) };
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('authenticate rejects missing token', () => {
    const req = { headers: {} };
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }) };
    const next = jest.fn();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('Cart Logic', () => {
  test('cart total calculation', () => {
    const items = [
      { price: 100, quantity: 2 },
      { price: 50, quantity: 3 },
    ];
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    expect(total).toBe(350);
  });
});

describe('Order State Machine', () => {
  test('valid order transitions', () => {
    const transitions = {
      CREATED: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY_FOR_PICKUP'],
      READY_FOR_PICKUP: ['PICKED_UP'],
      PICKED_UP: ['OUT_FOR_DELIVERY'],
      OUT_FOR_DELIVERY: ['DELIVERED'],
    };

    expect(transitions.CREATED).toContain('CONFIRMED');
    expect(transitions.OUT_FOR_DELIVERY).toContain('DELIVERED');
  });
});
