const { query, paginationMeta } = require('@foodflow/shared');

const mockEmails = [];

async function createNotification(userId, { type, title, message, metadata = {} }) {
  const result = await query(
    `INSERT INTO notifications (user_id, type, title, message, metadata)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, type, title, message, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

async function sendMockEmail(to, subject, body) {
  const email = { to, subject, body, sentAt: new Date().toISOString() };
  mockEmails.push(email);
  console.log(`[Email Mock] To: ${to} | Subject: ${subject}`);
  return email;
}

async function getNotifications(userId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const countResult = await query('SELECT COUNT(*) FROM notifications WHERE user_id = $1', [userId]);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [userId, limit, offset]
  );

  return { notifications: result.rows, pagination: paginationMeta(total, page, limit) };
}

async function markAsRead(notificationId, userId) {
  const result = await query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
    [notificationId, userId]
  );
  return result.rows[0];
}

async function markAllAsRead(userId) {
  await query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false', [userId]);
  return { message: 'All notifications marked as read' };
}

async function getUnreadCount(userId) {
  const result = await query(
    'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

function getMockEmails() {
  return mockEmails;
}

module.exports = {
  createNotification,
  sendMockEmail,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  getMockEmails,
};
