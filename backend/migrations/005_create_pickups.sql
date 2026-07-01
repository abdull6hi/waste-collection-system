CREATE TABLE pickups (
  id           SERIAL PRIMARY KEY,
  schedule_id  INTEGER        REFERENCES schedules(id) ON DELETE SET NULL,
  zone_id      INTEGER        NOT NULL REFERENCES zones(id),
  collector_id INTEGER        NOT NULL REFERENCES collectors(id),
  status       pickup_status  NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pickups_schedule_id  ON pickups (schedule_id);
CREATE INDEX idx_pickups_zone_id      ON pickups (zone_id);
CREATE INDEX idx_pickups_collector_id ON pickups (collector_id);
CREATE INDEX idx_pickups_status       ON pickups (status);
