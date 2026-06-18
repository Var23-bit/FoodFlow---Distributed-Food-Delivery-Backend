const { createClient } = require('redis');

let client = null;

async function connectRedis(config = {}) {
  if (client?.isOpen) return client;

  client = createClient({
    socket: {
      host: config.host || process.env.REDIS_HOST || 'localhost',
      port: parseInt(config.port || process.env.REDIS_PORT || '6379', 10),
    },
  });

  client.on('error', (err) => console.error('Redis Client Error:', err));

  await client.connect();
  return client;
}

async function getRedis() {
  if (!client?.isOpen) {
    await connectRedis();
  }
  return client;
}

async function cacheGet(key) {
  const redis = await getRedis();
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function cacheSet(key, value, ttlSeconds = 3600) {
  const redis = await getRedis();
  await redis.setEx(key, ttlSeconds, JSON.stringify(value));
}

async function cacheDel(key) {
  const redis = await getRedis();
  await redis.del(key);
}

async function cacheDelPattern(pattern) {
  const redis = await getRedis();
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(keys);
  }
}

async function closeRedis() {
  if (client?.isOpen) {
    await client.quit();
    client = null;
  }
}

module.exports = {
  connectRedis,
  getRedis,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  closeRedis,
};
