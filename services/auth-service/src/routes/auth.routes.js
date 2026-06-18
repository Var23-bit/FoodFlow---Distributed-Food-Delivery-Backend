const { Router } = require('express');
const { body } = require('express-validator');
const {
  validate,
  authenticate,
  asyncHandler,
  successResponse,
  ROLES,
} = require('@foodflow/shared');
const authService = require('../services/auth.service');

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               role: { type: string, enum: [CUSTOMER, RESTAURANT_OWNER, DELIVERY_PARTNER] }
 */
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn([ROLES.CUSTOMER, ROLES.RESTAURANT_OWNER, ROLES.DELIVERY_PARTNER]),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const user = await authService.register(req.body);
    return successResponse(res, user, 'Registration successful', 201);
  })
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body.email, req.body.password);
    return successResponse(res, result, 'Login successful');
  })
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 */
router.post(
  '/refresh',
  [body('refreshToken').notEmpty(), validate],
  asyncHandler(async (req, res) => {
    const tokens = await authService.refresh(req.body.refreshToken);
    return successResponse(res, tokens, 'Token refreshed');
  })
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await authService.logout(req.user.id);
    return successResponse(res, null, 'Logout successful');
  })
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 */
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail(), validate],
  asyncHandler(async (req, res) => {
    const result = await authService.requestPasswordReset(req.body.email);
    return successResponse(res, result);
  })
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 */
router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('newPassword').isLength({ min: 6 }),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.body.token, req.body.newPassword);
    return successResponse(res, result);
  })
);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await authService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return successResponse(res, user);
  })
);

module.exports = router;
