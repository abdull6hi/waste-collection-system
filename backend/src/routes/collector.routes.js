import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { list, getOne, create, update, deactivate, activate, getMyProfile, getMyResidents } from '../controllers/collector.controller.js';

const router = Router();
router.use(authenticate);

const createRules = [
  body('name').trim().notEmpty().withMessage('name is required')
    .isLength({ max: 100 }).withMessage('name must be 100 characters or fewer'),
  body('email').isEmail().withMessage('A valid email address is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('company_name').trim().notEmpty().withMessage('company_name is required')
    .isLength({ max: 200 }).withMessage('company_name must be 200 characters or fewer'),
  body('license_no').trim().notEmpty().withMessage('license_no is required')
    .isLength({ max: 100 }).withMessage('license_no must be 100 characters or fewer'),
  body('license_expiry').optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('license_expiry must be a valid date (YYYY-MM-DD)'),
];

const updateRules = [
  body('company_name').optional().trim().isLength({ min: 1, max: 200 })
    .withMessage('company_name must not be empty'),
  body('license_no').optional().trim().isLength({ min: 1, max: 100 })
    .withMessage('license_no must not be empty'),
  body('license_expiry').optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('license_expiry must be a valid date (YYYY-MM-DD)'),
  body('active').optional().isBoolean().withMessage('active must be true or false'),
];

router.get('/',             list);
router.get('/me',           requireRole('collector'), getMyProfile);
router.get('/me/residents', requireRole('collector'), getMyResidents);
router.get('/:id',          getOne);

router.post('/',                requireRole('official'), createRules, validate, create);
router.put('/:id',             requireRole('official'), updateRules,  validate, update);
router.patch('/:id/deactivate', requireRole('official'), deactivate);
router.patch('/:id/activate',   requireRole('official'), activate);

export default router;
