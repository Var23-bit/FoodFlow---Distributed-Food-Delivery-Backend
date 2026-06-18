const { Pool } = require('pg');

let pool = null;

function createPool(config = {}) {
  if (pool) return pool;

  pool = new Pool({
    host: config.host || process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(config.port || process.env.POSTGRES_PORT || '5432', 10),
    user: config.user || process.env.POSTGRES_USER || 'foodflow',
    password: config.password || process.env.POSTGRES_PASSWORD || 'foodflow_secret',
    database: config.database || process.env.POSTGRES_DB || 'foodflow',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
  });

  return pool;
}

async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
  }
  return result;
}

async function getClient() {
  return pool.connect();
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { createPool, query, getClient, closePool };
