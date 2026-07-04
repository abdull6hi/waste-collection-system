-- One-time login codes for email-based two-factor authentication.
-- A row is created when a user passes password check; it is consumed (or expires)
-- when they submit the matching code. Codes are stored hashed, never in plaintext.
CREATE TABLE login_codes (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   VARCHAR(64)  NOT NULL,          -- sha256 hex of the 6-digit code
  expires_at  TIMESTAMPTZ  NOT NULL,
  consumed_at TIMESTAMPTZ,                     -- set once used or superseded
  attempts    INTEGER      NOT NULL DEFAULT 0, -- wrong-code attempts against this row
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_codes_user ON login_codes (user_id);
