import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate }                  from '../middleware/validate.middleware.js';
import { generate, list, listMine, updateStatus, stats } from '../controllers/pickup.controller.js';

const router = Router();
router.use(authenticate);

// Max date span allowed for /generate — prevents a single request from
// iterating years of dates and inserting thousands of rows in one shot.
const MAX_GENERATE_DAYS = 90;

const generateRules = [
  body('from')
    .optional()
    .isISO8601().withMessage('from must be a valid ISO date (YYYY-MM-DD)'),
  body('to')
    .optional()
    .isISO8601().withMessage('to must be a valid ISO date (YYYY-MM-DD)')
    .custom((to, { req }) => {
      if (req.body.from && to < req.body.from) {
        throw new Error('to must be on or after from');
      }
      if (req.body.from) {
        const msPerDay = 24 * 60 * 60 * 1000;
        const days = (new Date(to) - new Date(req.body.from)) / msPerDay;
        if (days > MAX_GENERATE_DAYS) {
          throw new Error(`date range must be ${MAX_GENERATE_DAYS} days or fewer`);
        }
      }
      return true;
    }),
];

const statusRules = [
  body('status').isIn(['completed', 'missed']).withMessage('status must be completed or missed'),
  body('notes').if(body('status').equals('missed'))
    .notEmpty().withMessage('notes are required when marking a pickup as missed'),
];

const idParam = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
];

// Static paths BEFORE /:id
router.post('/generate', requireRole('official'), generateRules, validate, generate);
router.get('/mine',      requireRole('collector'), listMine);
router.get('/stats',     requireRole('official'), stats);
router.get('/',          requireRole('official'), list);

router.patch('/:id/status', requireRole('collector'), idParam, statusRules, validate, updateStatus);

export default router;
