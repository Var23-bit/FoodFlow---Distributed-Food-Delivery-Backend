const { getRedis } = require('../redis');
const { REDIS_KEYS } = require('../constants');

async function rateLimiter(req, res, next) {
  try {
    const max = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = REDIS_KEYS.RATE_LIMIT(ip);

    const redis = await getRedis();
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.pExpire(key, windowMs);
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));

    if (current > max) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
      });
    }

    next();
  } catch (err) {
    console.error('Rate limiter error:', err);
    next();
  }
}

module.exports = { rateLimiter };
