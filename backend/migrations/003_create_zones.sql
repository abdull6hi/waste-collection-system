CREATE TABLE zones (
  id                    SERIAL PRIMARY KEY,
  name                  VARCHAR(100) NOT NULL,
  description           TEXT,
  boundary_geojson      JSONB,
  assigned_collector_id INTEGER REFERENCES collectors(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_zones_assigned_collector ON zones (assigned_collector_id);
