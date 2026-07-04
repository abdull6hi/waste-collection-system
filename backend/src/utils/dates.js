/**
 * Shared UTC date/week utilities.
 *
 * All functions operate in UTC to avoid timezone off-by-one errors that arise
 * when mixing local Date methods (getDay, setDate) with ISO-string slicing.
 * Previously the seed used local-time helpers; now both seed and pickup
 * controller import from here so the logic is consistent.
 */

/**
 * Return the Monday of the ISO week that contains `date` (UTC).
 * @param {Date} date
 * @returns {Date} midnight UTC of that Monday
 */
export function mondayOf(date) {
  const d = new Date(date);
  const dow = d.getUTCDay(); // 0 = Sun … 6 = Sat
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - daysSinceMon);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Return the number of whole ISO weeks between two dates.
 * Both dates are snapped to their Monday first so partial weeks don't count.
 * Result is always >= 0 (absolute value of the difference).
 *
 * Used for biweekly schedule parity: even index (0, 2, 4 …) means "active week".
 *
 * @param {Date} anchor  – reference point (e.g. schedule.created_at)
 * @param {Date} target  – the date being evaluated
 * @returns {number} integer number of weeks
 */
export function weeksBetween(anchor, target) {
  const anchorMon = mondayOf(anchor).getTime();
  const targetMon = mondayOf(target).getTime();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.round(Math.abs(targetMon - anchorMon) / msPerWeek);
}

/**
 * Return the ISO date strings (YYYY-MM-DD) for the current UTC week
 * (Monday → Sunday).
 * @returns {{ from: string, to: string }}
 */
export function currentWeekRange() {
  const today  = new Date();
  const monday = mondayOf(today);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    from: monday.toISOString().slice(0, 10),
    to:   sunday.toISOString().slice(0, 10),
  };
}

/**
 * Expand a date range into an array of { str, dow } objects (UTC day-of-week).
 * @param {string} fromStr  YYYY-MM-DD
 * @param {string} toStr    YYYY-MM-DD
 * @returns {{ str: string, dow: number }[]}
 */
export function iterateDates(fromStr, toStr) {
  const dates = [];
  const cur   = new Date(fromStr + 'T00:00:00Z');
  const end   = new Date(toStr   + 'T00:00:00Z');
  while (cur <= end) {
    dates.push({ str: cur.toISOString().slice(0, 10), dow: cur.getUTCDay() });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/* ── Collector licence expiry ─────────────────────────────────── */

/** A licence within this many days of expiry is flagged "expiring soon". */
export const LICENCE_EXPIRY_WARN_DAYS = 30;

/**
 * Extract calendar {y, m, d} from a DATE value, or null if none.
 * Accepts a Date (node-postgres returns DATE columns as a local-midnight Date,
 * whose local components are the stored calendar date) or a 'YYYY-MM-DD' string.
 */
function calendarParts(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
  }
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/**
 * Classify a collector's licence by its expiry date (date-only comparison).
 * Both the expiry and "today" are reduced to calendar dates and diffed as whole
 * days, so the result is timezone-stable.
 *
 *  - none          → no expiry recorded (null)             → days_to_expiry: null
 *  - expired       → expiry is before today               → days_to_expiry < 0
 *  - expiring_soon → today ≤ expiry ≤ today + WARN_DAYS    → 0 ≤ days ≤ WARN_DAYS
 *  - valid         → expiry is more than WARN_DAYS away    → days > WARN_DAYS
 *
 * @param {Date|string|null} licenseExpiry
 * @returns {{ status: 'none'|'expired'|'expiring_soon'|'valid', days_to_expiry: number|null }}
 */
export function licenceStatus(licenseExpiry) {
  const parts = calendarParts(licenseExpiry);
  if (!parts) return { status: 'none', days_to_expiry: null };

  const now       = new Date();
  const todayUTC  = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryUTC = Date.UTC(parts.y, parts.m - 1, parts.d);
  const msPerDay  = 24 * 60 * 60 * 1000;
  const days      = Math.round((expiryUTC - todayUTC) / msPerDay);

  let status;
  if (days < 0)                            status = 'expired';
  else if (days <= LICENCE_EXPIRY_WARN_DAYS) status = 'expiring_soon';
  else                                     status = 'valid';

  return { status, days_to_expiry: days };
}
