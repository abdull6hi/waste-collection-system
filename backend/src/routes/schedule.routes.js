import { Router } from 'express';
import { body }   from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate }                  from '../middleware/validate.middleware.js';
import { list, getOne, create, update, remove, getMine, getByZone } from '../controllers/schedule.controller.js';

const router = Router();
router.use(authenticate);

// POST /  — all fields required (creating a new schedule)
const scheduleRules = [
  body('day_of_week').isInt({ min: 0, max: 6 }).withMessage('day_of_week must be 0 (Sun) – 6 (Sat)'),
  body('start_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('start_time must be HH:MM'),
  body('frequency').isIn(['daily', 'weekly', 'biweekly']).withMessage('frequency must be daily, weekly, or biweekly'),
];

// PUT /:id — all fields optional (partial update via COALESCE in the model)
const scheduleUpdateRules = [
  body('day_of_week').optional().isInt({ min: 0, max: 6 }).withMessage('day_of_week must be 0 (Sun) – 6 (Sat)'),
  body('start_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('start_time must be HH:MM'),
  body('frequency').optional().isIn(['daily', 'weekly', 'biweekly']).withMessage('frequency must be daily, weekly, or biweekly'),
];

// Static paths BEFORE /:id to avoid Express treating 'mine' as an id param
router.get('/mine',          requireRole('collector'), getMine);
// Any authenticated user may view the schedule for a zone (residents use this
// to see their upcoming pickups; no PII is exposed — just schedule times).
router.get('/zone/:zoneId',  getByZone);

router.get('/',    requireRole('official'), list);
router.get('/:id', requireRole('official'), getOne);
router.post('/',   requireRole('official'), scheduleRules,       validate, create);
router.put('/:id', requireRole('official'), scheduleUpdateRules, validate, update);
router.delete('/:id', requireRole('official'), remove);

export default router;
