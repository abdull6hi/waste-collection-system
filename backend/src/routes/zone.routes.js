import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { list, getOne, create, update, remove, assignCollector, listPublic } from '../controllers/zone.controller.js';

const router = Router();

// Public, unauthenticated — id + name only, for the registration dropdown.
// Registered BEFORE the authenticate gate below so it stays open.
router.get('/public', listPublic);

router.use(authenticate);

const zoneRules = [
  body('name').trim().notEmpty().withMessage('name is required')
    .isLength({ max: 100 }).withMessage('name must be 100 characters or fewer'),
  body('description').optional().trim(),
];

const assignRules = [
  body('collector_id')
    .custom(v => v === null || v === undefined || (Number.isInteger(Number(v)) && Number(v) > 0))
    .withMessage('collector_id must be a positive integer or null'),
];

router.get('/',    list);
router.get('/:id', getOne);

router.post('/',            requireRole('official'), zoneRules,   validate, create);
router.put('/:id',          requireRole('official'), zoneRules,   validate, update);
router.delete('/:id',       requireRole('official'), remove);
router.patch('/:id/assign', requireRole('official'), assignRules, validate, assignCollector);

export default router;
