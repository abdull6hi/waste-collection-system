// Centralized error handler — must be the LAST middleware registered in app.js.
// Returns a consistent { error: { message, details? } } shape to clients.

export function errorHandler(err, req, res, _next) {
  // Ownership violations thrown by ownership.js helpers
  if (err.name === 'OwnershipError') {
    return res.status(403).json({ error: { message: err.message } });
  }

  const pgCode = err.code;

  // PostgreSQL unique violation (duplicate email, license, etc.)
  if (pgCode === '23505') {
    return res.status(409).json({
      error: { message: 'A record with these details already exists.' },
    });
  }

  // PostgreSQL foreign key violation
  if (pgCode === '23503') {
    return res.status(409).json({
      error: { message: 'The referenced record is in use or does not exist.' },
    });
  }

  // PostgreSQL invalid input for enum or integer type
  if (pgCode === '22P02' || pgCode === '22003') {
    return res.status(400).json({
      error: { message: 'Invalid value provided.' },
    });
  }

  // Log full error server-side only; never expose stack to the client
  console.error(`[${new Date().toISOString()}] Unhandled error: ${err.message}`);
  console.error(err.stack);

  res.status(500).json({
    error: { message: 'An unexpected error occurred. Please try again later.' },
  });
}

// 404 handler for unmatched /api routes
export function notFound(req, res) {
  res.status(404).json({ error: { message: 'Not found' } });
}
