const bcrypt = require('bcryptjs');
const { createPool, query, hashPassword } = require('@foodflow/shared');

async function seed() {
  createPool();

  const adminHash = await hashPassword('Admin@123');
  await query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = $3`,
    ['Admin User', 'admin@foodflow.com', adminHash, 'ADMIN']
  );

  const customerHash = await hashPassword('Customer@123');
  const customer = await query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = $3 RETURNING id`,
    ['John Customer', 'customer@foodflow.com', customerHash, 'CUSTOMER']
  );

  const ownerHash = await hashPassword('Owner@123');
  const owner = await query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = $3 RETURNING id`,
    ['Restaurant Owner', 'owner@foodflow.com', ownerHash, 'RESTAURANT_OWNER']
  );

  const partnerHash = await hashPassword('Partner@123');
  await query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = $3`,
    ['Delivery Partner', 'partner@foodflow.com', partnerHash, 'DELIVERY_PARTNER']
  );

  const existingRestaurant = await query(
    'SELECT id FROM restaurants WHERE owner_id = $1 LIMIT 1',
    [owner.rows[0].id]
  );

  let restaurantId;
  if (existingRestaurant.rows.length > 0) {
    restaurantId = existingRestaurant.rows[0].id;
  } else {
    const restaurant = await query(
      `INSERT INTO restaurants (owner_id, name, description, address, rating)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [owner.rows[0].id, 'Spice Garden', 'Authentic Indian cuisine', '123 Main Street, Mumbai', 4.5]
    );
    restaurantId = restaurant.rows[0].id;
  }

  const menuCount = await query('SELECT COUNT(*) FROM menu_items WHERE restaurant_id = $1', [restaurantId]);
  if (parseInt(menuCount.rows[0].count, 10) === 0) {
    const menuItems = [
      ['Butter Chicken', 'Creamy tomato-based curry', 350, 'Main Course'],
      ['Paneer Tikka', 'Grilled cottage cheese', 280, 'Starters'],
      ['Biryani', 'Fragrant rice dish', 320, 'Main Course'],
      ['Naan', 'Traditional flatbread', 50, 'Breads'],
      ['Mango Lassi', 'Refreshing yogurt drink', 80, 'Beverages'],
    ];

    for (const [name, desc, price, category] of menuItems) {
      await query(
        `INSERT INTO menu_items (restaurant_id, name, description, price, category)
         VALUES ($1, $2, $3, $4, $5)`,
        [restaurantId, name, desc, price, category]
      );
    }
  }

  const existingAddress = await query(
    'SELECT id FROM addresses WHERE user_id = $1 LIMIT 1',
    [customer.rows[0].id]
  );

  if (existingAddress.rows.length === 0) {
    await query(
      `INSERT INTO addresses (user_id, address_line, city, state, pincode, is_default)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [customer.rows[0].id, '456 Oak Avenue', 'Mumbai', 'Maharashtra', '400001']
    );
  }

  console.log('Seed data created successfully!');
  console.log('\nTest Accounts:');
  console.log('  Admin:    admin@foodflow.com / Admin@123');
  console.log('  Customer: customer@foodflow.com / Customer@123');
  console.log('  Owner:    owner@foodflow.com / Owner@123');
  console.log('  Partner:  partner@foodflow.com / Partner@123');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
