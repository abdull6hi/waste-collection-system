ALTER TABLE pickups ADD COLUMN scheduled_date DATE;

CREATE UNIQUE INDEX idx_pickups_schedule_date
  ON pickups (schedule_id, scheduled_date)
  WHERE schedule_id IS NOT NULL;

ALTER TABLE users ADD COLUMN zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL;
