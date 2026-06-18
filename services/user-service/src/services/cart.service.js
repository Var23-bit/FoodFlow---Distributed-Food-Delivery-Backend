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
  const existing = cart.items.find((i) => i.menuItemId === item.menuItemId);

  if (existing) {
    existing.quantity += item.quantity;
  } else {
    cart.items.push({
      id: item.menuItemId,
      menuItemId: item.menuItemId,
      restaurantId: item.restaurantId,
      name: item.name,
      price: item.price,
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
