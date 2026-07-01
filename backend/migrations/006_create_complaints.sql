CREATE TABLE complaints (
  id          SERIAL             PRIMARY KEY,
  resident_id INTEGER            NOT NULL REFERENCES users(id),
  zone_id     INTEGER            NOT NULL REFERENCES zones(id),
  category    complaint_category NOT NULL,
  description TEXT               NOT NULL,
  status      complaint_status   NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_complaints_resident_id ON complaints (resident_id);
CREATE INDEX idx_complaints_zone_id     ON complaints (zone_id);
CREATE INDEX idx_complaints_status      ON complaints (status);
