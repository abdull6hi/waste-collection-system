import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const result = await query('SELECT NOW()', []);
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: result.rows[0].now,
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: err.message,
    });
  }
});

export default router;
