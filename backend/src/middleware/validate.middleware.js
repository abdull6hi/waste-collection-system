import { validationResult } from 'express-validator';

// Runs after express-validator rules; short-circuits with a consistent error shape on failure.
export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        message: errors.array()[0].msg,
        details: errors.array(),
      },
    });
  }
  next();
}
