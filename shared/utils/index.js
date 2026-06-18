const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateId() {
  return uuidv4();
}

function paginate(query, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  return { ...query, limit: parseInt(limit, 10), offset: parseInt(offset, 10) };
}

function paginationMeta(total, page, limit) {
  return {
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = {
  hashPassword,
  comparePassword,
  generateId,
  paginate,
  paginationMeta,
};
