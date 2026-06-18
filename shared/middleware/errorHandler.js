function errorHandler(err, req, res, next) {
  console.error(`[${req.method}] ${req.path}:`, err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Resource already exists' });
  }

  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced resource not found' });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
}

function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Route not found' });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function successResponse(res, data, message = 'Success', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

module.exports = { errorHandler, notFound, asyncHandler, successResponse };
