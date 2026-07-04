import { Router } from 'express';
import { body } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import { register, login, verifyOtp, resendOtp, me } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

// Disabled only when explicitly opted out (the integration suite sets this) —
// enabled by default so production always rate-limits auth endpoints.
const RATE_LIMIT_DISABLED = process.env.RATE_LIMIT_DISABLED === 'true';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please try again in 15 minutes.' } },
  skip: () => RATE_LIMIT_DISABLED,
});

const registerRules = [
  body('name').trim().notEmpty().withMessage('name is required')
    .isLength({ max: 100 }).withMessage('name must be 100 characters or fewer'),
  body('email').isEmail().withMessage('A valid email address is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('zone_id').isInt({ min: 1 }).withMessage('Please select your collection zone'),
  body('contact_phone').trim().notEmpty().withMessage('Contact phone is required')
    .isLength({ max: 20 }).withMessage('contact_phone must be 20 characters or fewer'),
  body('collector_id').optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 }).withMessage('collector_id must be a positive integer'),
  // 'role' is intentionally NOT accepted here — public registration always creates 'resident'
];

const loginRules = [
  body('email').isEmail().withMessage('A valid email address is required'),
  body('password').notEmpty().withMessage('password is required'),
];

const verifyOtpRules = [
  body('email').isEmail().withMessage('A valid email address is required'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('code must be 6 digits')
    .isNumeric().withMessage('code must be numeric'),
];

const resendOtpRules = [
  body('email').isEmail().withMessage('A valid email address is required'),
];

router.post('/register',   authLimiter, registerRules,  validate, register);
router.post('/login',      authLimiter, loginRules,     validate, login);
router.post('/verify-otp', authLimiter, verifyOtpRules, validate, verifyOtp);
router.post('/resend-otp', authLimiter, resendOtpRules, validate, resendOtp);
router.get('/me', authenticate, me);

export default router;
