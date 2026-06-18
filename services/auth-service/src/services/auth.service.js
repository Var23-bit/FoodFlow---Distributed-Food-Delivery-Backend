const {
  query,
  cacheSet,
  cacheDel,
  getRedis,
  REDIS_KEYS,
  publishEvent,
  KAFKA_TOPICS,
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  ROLES,
} = require('@foodflow/shared');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

async function register({ name, email, password, role = ROLES.CUSTOMER }) {
  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name, email.toLowerCase(), passwordHash, role]
  );

  const user = result.rows[0];
  await publishEvent(KAFKA_TOPICS.USER_REGISTERED, { userId: user.id, email: user.email, role: user.role });
  return user;
}

async function login(email, password) {
  const result = await query(
    'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const user = result.rows[0];
  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ id: user.id });

  const redis = await getRedis();
  await redis.setEx(REDIS_KEYS.REFRESH_TOKEN(user.id), 7 * 24 * 3600, refreshToken);

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  };
}

async function refresh(refreshToken) {
  const decoded = verifyRefreshToken(refreshToken);
  const redis = await getRedis();
  const stored = await redis.get(REDIS_KEYS.REFRESH_TOKEN(decoded.id));

  if (!stored || stored !== refreshToken) {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }

  const result = await query(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [decoded.id]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const user = result.rows[0];
  const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken({ id: user.id });

  await redis.setEx(REDIS_KEYS.REFRESH_TOKEN(user.id), 7 * 24 * 3600, newRefreshToken);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

async function logout(userId) {
  await cacheDel(REDIS_KEYS.REFRESH_TOKEN(userId));
}

async function requestPasswordReset(email) {
  const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (result.rows.length === 0) {
    return { message: 'If the email exists, a reset link will be sent' };
  }

  const userId = result.rows[0].id;
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 3600000);

  await query(
    'DELETE FROM password_reset_tokens WHERE user_id = $1',
    [userId]
  );
  await query(
    'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );

  await publishEvent(KAFKA_TOPICS.PASSWORD_RESET, { userId, email, token });

  return { message: 'If the email exists, a reset link will be sent', resetToken: token };
}

async function resetPassword(token, newPassword) {
  const result = await query(
    `SELECT prt.user_id FROM password_reset_tokens prt
     WHERE prt.token = $1 AND prt.expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Invalid or expired reset token'), { status: 400 });
  }

  const userId = result.rows[0].user_id;
  const passwordHash = await hashPassword(newPassword);

  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);
  await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
  await cacheDel(REDIS_KEYS.REFRESH_TOKEN(userId));

  return { message: 'Password reset successful' };
}

async function getUserById(id) {
  const result = await query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  requestPasswordReset,
  resetPassword,
  getUserById,
};
