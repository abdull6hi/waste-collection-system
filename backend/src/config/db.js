import pg from 'pg';

const { Pool, types } = pg;

// DATE columns (pickups.scheduled_date, reports.period_start/period_end) carry no time
// component. pg's default parser converts them to a JS Date at LOCAL midnight, which then
// shifts to the wrong calendar day once serialized via toISOString()/JSON on a server whose
// timezone is ahead of UTC — e.g. Africa/Nairobi, this system's own deployment target.
// Returning the raw 'YYYY-MM-DD' string sidesteps that: every date-only column becomes an
// unambiguous calendar date instead of a timezone-dependent instant.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

pool.connect()
  .then(client => {
    console.log('Database connected');
    client.release();
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
  });

export async function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
