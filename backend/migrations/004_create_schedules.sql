CREATE TABLE schedules (
  id           SERIAL PRIMARY KEY,
  zone_id      INTEGER           NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  collector_id INTEGER           NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
  day_of_week  SMALLINT          NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME              NOT NULL,
  frequency    schedule_frequency NOT NULL DEFAULT 'weekly',
  created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedules_zone_id      ON schedules (zone_id);
CREATE INDEX idx_schedules_collector_id ON schedules (collector_id);
