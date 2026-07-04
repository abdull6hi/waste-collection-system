import { Router } from 'express';
import { body } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import { register, login, me } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please try again in 15 minutes.' } },
});

const registerRules = [
  body('name').trim().notEmpty().withMessage('name is required')
    .isLength({ max: 100 }).withMessage('name must be 100 characters or fewer'),
  body('email').isEmail().withMessage('A valid email address is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('zone_id').isInt({ min: 1 }).withMessage('Please select your collection zone'),
  body('contact_phone').trim().notEmpty().withMessage('Contact phone is required')
    .isLength({ max: 20 }).withMessage('contact_phone must be 20 characters or fewer'),
  // 'role' is intentionally NOT accepted here — public registration always creates 'resident'
];

const loginRules = [
  body('email').isEmail().withMessage('A valid email address is required'),
  body('password').notEmpty().withMessage('password is required'),
];

router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login',    authLimiter, loginRules,    validate, login);
router.get('/me', authenticate, me);

export default router;
