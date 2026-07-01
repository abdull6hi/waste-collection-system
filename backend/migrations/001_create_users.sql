-- ENUM types (defined once, shared across tables)
CREATE TYPE user_role AS ENUM ('official', 'collector', 'resident');
CREATE TYPE pickup_status AS ENUM ('pending', 'in_progress', 'completed', 'missed');
CREATE TYPE complaint_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE complaint_category AS ENUM ('missed_pickup', 'illegal_dumping', 'overflowing_bin', 'damaged_equipment', 'other');
CREATE TYPE schedule_frequency AS ENUM ('daily', 'weekly', 'biweekly');

CREATE TABLE users (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100)  NOT NULL,
  email        VARCHAR(255)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role         user_role     NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role  ON users (role);
