import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { setMyZone, updateMyProfile, changeMyPassword, createOfficial } from '../controllers/user.controller.js';

const router = Router();

const zoneRules = [
  body('zone_id').isInt({ min: 1 }).withMessage('zone_id must be a positive integer'),
];

const profileRules = [
  body('name').trim().notEmpty().withMessage('name is required')
    .isLength({ max: 100 }).withMessage('name must be 100 characters or fewer'),
  body('email').isEmail().withMessage('A valid email address is required').normalizeEmail(),
  body('contact_phone').optional({ nullable: true, checkFalsy: false }).trim()
    .isLength({ max: 20 }).withMessage('contact_phone must be 20 characters or fewer'),
];

const passwordRules = [
  body('currentPassword').notEmpty().withMessage('currentPassword is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('newPassword must be at least 8 characters'),
];

router.patch('/me',          authenticate, profileRules,  validate, updateMyProfile);
router.patch('/me/password', authenticate, passwordRules, validate, changeMyPassword);
router.patch('/me/zone',     authenticate, requireRole('resident'), zoneRules, validate, setMyZone);

// Official-only: create another official account (mirrors POST /api/collectors for collectors)
const officialRules = [
  body('name').trim().notEmpty().withMessage('name is required')
    .isLength({ max: 100 }).withMessage('name must be 100 characters or fewer'),
  body('email').isEmail().withMessage('A valid email address is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];
router.post('/officials', authenticate, requireRole('official'), officialRules, validate, createOfficial);

export default router;
