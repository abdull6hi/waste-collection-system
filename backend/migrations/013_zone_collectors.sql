-- Multiple approved collectors per zone, and each resident's chosen collector.
--
-- zones.assigned_collector_id is KEPT as the zone's default/primary collector
-- (fallback for routing and for residents who haven't chosen). Invariant: the
-- default is always ALSO a row in zone_collectors.

CREATE TABLE zone_collectors (
  zone_id      INTEGER NOT NULL REFERENCES zones(id)      ON DELETE CASCADE,
  collector_id INTEGER NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
  PRIMARY KEY (zone_id, collector_id)
);

-- Speeds up "which residents chose this collector" / cascade-on-remove lookups.
CREATE INDEX idx_zone_collectors_collector ON zone_collectors (collector_id);

-- A resident's chosen collector (must be approved+active for their zone; enforced
-- server-side). NULL = no explicit choice → routing falls back to the zone default.
ALTER TABLE users ADD COLUMN collector_id INTEGER REFERENCES collectors(id) ON DELETE SET NULL;

CREATE INDEX idx_users_collector_id ON users (collector_id);

-- Backfill 1: every zone's current default collector becomes an approved pair,
-- so the default invariant holds immediately.
INSERT INTO zone_collectors (zone_id, collector_id)
SELECT id, assigned_collector_id
FROM zones
WHERE assigned_collector_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill 2: residents inherit their zone's default collector, preserving the
-- current "My Residents" results (which previously derived from the zone default).
UPDATE users u
SET collector_id = z.assigned_collector_id
FROM zones z
WHERE u.role = 'resident'
  AND u.zone_id = z.id
  AND z.assigned_collector_id IS NOT NULL;
