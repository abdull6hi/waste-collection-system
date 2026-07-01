import { Router } from 'express';
import { body }   from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate }                  from '../middleware/validate.middleware.js';
import {
  submit, listMine, listAssigned, list, getOne, updateStatus, openByZone,
} from '../controllers/complaint.controller.js';

const router = Router();
router.use(authenticate);

const CATEGORIES = ['missed_pickup', 'illegal_dumping', 'overflowing_bin', 'damaged_equipment', 'other'];
const STATUSES   = ['open', 'in_progress', 'resolved', 'closed'];

const submitRules = [
  body('zone_id').isInt({ min: 1 }).withMessage('zone_id must be a positive integer'),
  body('category').isIn(CATEGORIES).withMessage(`category must be one of: ${CATEGORIES.join(', ')}`),
  body('description').trim().notEmpty().withMessage('description is required'),
];

const statusRules = [
  body('status').isIn(STATUSES).withMessage(`status must be one of: ${STATUSES.join(', ')}`),
];

// Static paths BEFORE /:id
router.get('/stats/open-by-zone', requireRole('official'), openByZone);
router.get('/mine',               requireRole('resident'),  listMine);
router.get('/assigned',           requireRole('collector'), listAssigned);

router.post('/',   requireRole('resident'), submitRules, validate, submit);
router.get('/',    requireRole('official'), list);
router.get('/:id', getOne);
router.patch('/:id/status', requireRole('collector', 'official'), statusRules, validate, updateStatus);

export default router;
