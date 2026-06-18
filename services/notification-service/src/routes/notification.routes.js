const { Router } = require('express');
const { param } = require('express-validator');
const { validate, authenticate, authorize, asyncHandler, successResponse, ROLES } = require('@foodflow/shared');
const notificationService = require('../services/notification.service');

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await notificationService.getNotifications(req.user.id, page, limit);
  return successResponse(res, result);
}));

router.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user.id);
  return successResponse(res, { count });
}));

router.patch('/:id/read',
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const notification = await notificationService.markAsRead(req.params.id, req.user.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    return successResponse(res, notification);
  })
);

router.patch('/read-all', asyncHandler(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.user.id);
  return successResponse(res, result);
}));

router.get('/admin/emails',
  authorize(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const emails = notificationService.getMockEmails();
    return successResponse(res, emails);
  })
);

module.exports = router;
