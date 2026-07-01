// Fail fast on startup if required environment variables are missing.
const REQUIRED = ['JWT_SECRET', 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'CORS_ORIGIN'];

export function validateEnv() {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Server cannot start — missing required environment variables: ${missing.join(', ')}\n` +
      'Copy .env.example to .env and fill in the values.'
    );
  }
}
