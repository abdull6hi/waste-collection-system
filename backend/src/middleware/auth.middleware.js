// JWT authentication and role-based access control middleware.
import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'No token provided' } });
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    // Log specifics server-side (expired vs malformed vs wrong-secret) without leaking to client
    console.warn('[auth] JWT verification failed:', err.name, err.message);
    res.status(401).json({ error: { message: 'Invalid or expired token' } });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: { message: 'Forbidden — insufficient role' } });
    }
    next();
  };
}
