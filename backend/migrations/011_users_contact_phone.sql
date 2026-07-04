-- Residents capture a contact phone at registration (editable later via profile).
-- Collectors keep their own contact_phone on the collectors table; this column is
-- for users (residents) who are not collectors. Nullable so existing rows are unaffected.
ALTER TABLE users ADD COLUMN contact_phone VARCHAR(20);
