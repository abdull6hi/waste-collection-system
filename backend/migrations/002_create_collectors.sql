CREATE TABLE collectors (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name  VARCHAR(200) NOT NULL,
  license_no    VARCHAR(100) NOT NULL UNIQUE,
  contact_phone VARCHAR(20),
  active        BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_collectors_user_id ON collectors (user_id);
CREATE INDEX idx_collectors_active  ON collectors (active);
