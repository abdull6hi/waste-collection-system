import { Router } from 'express';
import { body }   from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate }                  from '../middleware/validate.middleware.js';
import { generate, list, getOne, exportCsv } from '../controllers/report.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('official'));

const generateRules = [
  body('from')
    .isISO8601().withMessage('from must be a valid ISO date (YYYY-MM-DD)'),
  body('to')
    .isISO8601().withMessage('to must be a valid ISO date (YYYY-MM-DD)')
    .custom((to, { req }) => {
      if (to < req.body.from) throw new Error('to must be on or after from');
      return true;
    }),
];

router.post('/generate',          generateRules, validate, generate);
router.get('/',                   list);
router.get('/:id',                getOne);
router.get('/:id/export.csv',     exportCsv);

export default router;
