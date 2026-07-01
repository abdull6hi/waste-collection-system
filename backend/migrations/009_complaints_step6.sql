ALTER TABLE complaints
  ADD COLUMN reference_no          VARCHAR(30)  UNIQUE,
  ADD COLUMN assigned_collector_id INTEGER      REFERENCES collectors(id) ON DELETE SET NULL,
  ADD COLUMN resolved_at           TIMESTAMPTZ,
  ADD COLUMN resolution_notes      TEXT;

CREATE INDEX idx_complaints_assigned_collector_id ON complaints (assigned_collector_id);
