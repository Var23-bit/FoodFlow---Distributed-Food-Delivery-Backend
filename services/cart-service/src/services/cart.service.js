const { cacheGet, cacheSet, cacheDel, REDIS_KEYS, CACHE_TTL } = require('@foodflow/shared');

async function getCart(userId) {
  const cart = await cacheGet(REDIS_KEYS.CART(userId));
  return cart || { items: [], totalAmount: 0 };
}

async function saveCart(userId, cart) {
  await cacheSet(REDIS_KEYS.CART(userId), cart, CACHE_TTL.CART);
  return cart;
}

async function addItem(userId, item) {
  const cart = await getCart(userId);
  const hasDifferentRestaurant = cart.items.some((i) => i.restaurantId !== item.restaurantId);

  if (hasDifferentRestaurant) {
    throw Object.assign(new Error('Cart can contain items from one restaurant only'), { status: 400 });
  }

  // Validate item against restaurant menu cache
  const menuStr = await cacheGet(REDIS_KEYS.RESTAURANT_MENU(item.restaurantId));
  let menuItem;
  
  if (menuStr) {
    const menu = typeof menuStr === 'string' ? JSON.parse(menuStr) : menuStr;
    menuItem = menu.find(m => m.id === item.menuItemId);
  } else {
    // Fallback to calling restaurant service API (using native fetch in Node 18)
    try {
      const host = process.env.NODE_ENV === 'production' ? 'restaurant-service' : 'localhost';
      const port = process.env.RESTAURANT_SERVICE_PORT || 3003;
      const response = await fetch(`http://${host}:${port}/menu/restaurant/${item.restaurantId}`);
      if (response.ok) {
        const menu = await response.json();
        menuItem = menu.data.find(m => m.id === item.menuItemId);
      }
    } catch (e) {
      console.error('Error fetching menu from restaurant service', e);
    }
  }

  if (!menuItem) {
    throw Object.assign(new Error('Menu item not found'), { status: 404 });
  }

  if (!menuItem.availability) {
    throw Object.assign(new Error('Menu item is currently unavailable'), { status: 400 });
  }

  // Use the validated price
  const validatedPrice = Number(menuItem.price);

  const existing = cart.items.find((i) => i.menuItemId === item.menuItemId);

  if (existing) {
    existing.quantity += item.quantity;
  } else {
    cart.items.push({
      id: item.menuItemId,
      menuItemId: item.menuItemId,
      restaurantId: item.restaurantId,
      name: menuItem.name || item.name,
      price: validatedPrice,
      quantity: item.quantity,
    });
  }

  cart.totalAmount = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return saveCart(userId, cart);
}

async function removeItem(userId, menuItemId) {
  const cart = await getCart(userId);
  cart.items = cart.items.filter((i) => i.menuItemId !== menuItemId);
  cart.totalAmount = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return saveCart(userId, cart);
}

async function updateItemQuantity(userId, menuItemId, quantity) {
  const cart = await getCart(userId);
  const item = cart.items.find((i) => i.menuItemId === menuItemId);

  if (!item) {
    throw Object.assign(new Error('Item not found in cart'), { status: 404 });
  }

  if (quantity <= 0) {
    return removeItem(userId, menuItemId);
  }

  item.quantity = quantity;
  cart.totalAmount = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return saveCart(userId, cart);
}

async function clearCart(userId) {
  await cacheDel(REDIS_KEYS.CART(userId));
  return { items: [], totalAmount: 0 };
}

module.exports = { getCart, addItem, removeItem, updateItemQuantity, clearCart };
