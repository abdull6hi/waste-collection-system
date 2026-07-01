CREATE TABLE reports (
  id           SERIAL PRIMARY KEY,
  generated_by INTEGER     NOT NULL REFERENCES users(id),
  period_start DATE        NOT NULL,
  period_end   DATE        NOT NULL,
  summary_json JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_report_period CHECK (period_end >= period_start)
);

CREATE INDEX idx_reports_generated_by ON reports (generated_by);
CREATE INDEX idx_reports_period       ON reports (period_start, period_end);
