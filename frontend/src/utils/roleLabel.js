// Maps internal role identifiers to the human-readable labels shown to users.
//
// IMPORTANT: these are DISPLAY labels only. The role VALUE ('official',
// 'collector', 'resident') is an identifier used in JWTs, RBAC checks, and the
// database — it must never change here. Only the right-hand strings are UI text.
const ROLE_LABELS = {
  official:  'Administrator',
  collector: 'Collector',
  resident:  'Resident',
};

/** Returns the display label for a role value, falling back to the raw value. */
export function roleLabel(role) {
  return ROLE_LABELS[role] ?? role;
}
