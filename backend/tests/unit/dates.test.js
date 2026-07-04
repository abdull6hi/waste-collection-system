/**
 * Unit tests for src/utils/dates.js — pure functions, no DB required.
 */
import { describe, it, expect } from 'vitest';
import {
  mondayOf, weeksBetween, currentWeekRange, iterateDates,
  licenceStatus, LICENCE_EXPIRY_WARN_DAYS,
} from '../../src/utils/dates.js';

/** Build a 'YYYY-MM-DD' string `days` from today, matching licenceStatus's notion of "today". */
function ymdOffset(days) {
  const now  = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  base.setDate(base.getDate() + days);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

describe('mondayOf()', () => {
  it('returns itself when the date is already a Monday', () => {
    // 2024-01-01 is a Monday
    const monday = new Date('2024-01-01T12:00:00Z');
    const result = mondayOf(monday);
    expect(result.toISOString().slice(0, 10)).toBe('2024-01-01');
  });

  it('snaps a Wednesday back to the preceding Monday', () => {
    // 2024-01-03 is a Wednesday
    const wednesday = new Date('2024-01-03T08:00:00Z');
    expect(mondayOf(wednesday).toISOString().slice(0, 10)).toBe('2024-01-01');
  });

  it('snaps a Sunday back to the preceding Monday (not forward)', () => {
    // 2024-01-07 is a Sunday
    const sunday = new Date('2024-01-07T00:00:00Z');
    expect(mondayOf(sunday).toISOString().slice(0, 10)).toBe('2024-01-01');
  });

  it('returns UTC midnight regardless of input time', () => {
    const d = new Date('2024-01-03T23:59:59Z');
    const result = mondayOf(d);
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
  });
});

describe('weeksBetween()', () => {
  it('returns 0 for dates in the same ISO week', () => {
    const mon = new Date('2024-01-01T00:00:00Z');
    const wed = new Date('2024-01-03T00:00:00Z');
    expect(weeksBetween(mon, wed)).toBe(0);
  });

  it('returns 1 for dates exactly one week apart', () => {
    const week1 = new Date('2024-01-01T00:00:00Z');
    const week2 = new Date('2024-01-08T00:00:00Z');
    expect(weeksBetween(week1, week2)).toBe(1);
  });

  it('returns 2 for dates two weeks apart', () => {
    const week1 = new Date('2024-01-01T00:00:00Z');
    const week3 = new Date('2024-01-15T00:00:00Z');
    expect(weeksBetween(week1, week3)).toBe(2);
  });

  it('is symmetric (order of arguments does not matter)', () => {
    const a = new Date('2024-01-01T00:00:00Z');
    const b = new Date('2024-01-15T00:00:00Z');
    expect(weeksBetween(a, b)).toBe(weeksBetween(b, a));
  });

  it('biweekly parity: even weeks are active, odd weeks are skipped', () => {
    const anchor = new Date('2024-01-01T00:00:00Z'); // week 0 = active
    const week1  = new Date('2024-01-08T00:00:00Z'); // 1 week later = odd = skip
    const week2  = new Date('2024-01-15T00:00:00Z'); // 2 weeks later = even = active
    const week3  = new Date('2024-01-22T00:00:00Z'); // 3 weeks later = odd = skip
    const week4  = new Date('2024-01-29T00:00:00Z'); // 4 weeks later = even = active

    expect(weeksBetween(anchor, anchor) % 2).toBe(0); // active
    expect(weeksBetween(anchor, week1)  % 2).toBe(1); // skip
    expect(weeksBetween(anchor, week2)  % 2).toBe(0); // active
    expect(weeksBetween(anchor, week3)  % 2).toBe(1); // skip
    expect(weeksBetween(anchor, week4)  % 2).toBe(0); // active
  });
});

describe('currentWeekRange()', () => {
  it('returns from <= to', () => {
    const { from, to } = currentWeekRange();
    expect(from <= to).toBe(true);
  });

  it('from is a Monday', () => {
    const { from } = currentWeekRange();
    const d = new Date(from + 'T00:00:00Z');
    // 1 = Monday in UTC day-of-week
    expect(d.getUTCDay()).toBe(1);
  });

  it('to is a Sunday', () => {
    const { to } = currentWeekRange();
    const d = new Date(to + 'T00:00:00Z');
    expect(d.getUTCDay()).toBe(0); // 0 = Sunday
  });

  it('the range spans exactly 6 days (Mon–Sun)', () => {
    const { from, to } = currentWeekRange();
    const msPerDay = 24 * 60 * 60 * 1000;
    const days = (new Date(to) - new Date(from)) / msPerDay;
    expect(days).toBe(6);
  });
});

describe('iterateDates()', () => {
  it('includes both endpoints', () => {
    const dates = iterateDates('2024-01-01', '2024-01-03');
    expect(dates.map(d => d.str)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
  });

  it('returns a single entry when from === to', () => {
    const dates = iterateDates('2024-01-05', '2024-01-05');
    expect(dates).toHaveLength(1);
    expect(dates[0].str).toBe('2024-01-05');
  });

  it('each entry has the correct UTC day-of-week', () => {
    // 2024-01-01 is Monday (dow=1)
    const dates = iterateDates('2024-01-01', '2024-01-07');
    const dows = dates.map(d => d.dow);
    expect(dows).toEqual([1, 2, 3, 4, 5, 6, 0]); // Mon…Sun
  });
});

describe('licenceStatus()', () => {
  it('returns "none" with null days for a null expiry', () => {
    expect(licenceStatus(null)).toEqual({ status: 'none', days_to_expiry: null });
  });

  it('treats undefined and empty string as "none"', () => {
    expect(licenceStatus(undefined).status).toBe('none');
    expect(licenceStatus('').status).toBe('none');
  });

  it('classifies a past date as "expired" with negative days', () => {
    const res = licenceStatus(ymdOffset(-1));
    expect(res.status).toBe('expired');
    expect(res.days_to_expiry).toBe(-1);
  });

  it('classifies today as "expiring_soon" with 0 days', () => {
    const res = licenceStatus(ymdOffset(0));
    expect(res.status).toBe('expiring_soon');
    expect(res.days_to_expiry).toBe(0);
  });

  it('classifies a date within the warn window as "expiring_soon"', () => {
    const res = licenceStatus(ymdOffset(15));
    expect(res.status).toBe('expiring_soon');
    expect(res.days_to_expiry).toBe(15);
  });

  it('treats exactly WARN_DAYS out as the inclusive "expiring_soon" boundary', () => {
    const res = licenceStatus(ymdOffset(LICENCE_EXPIRY_WARN_DAYS));
    expect(res.status).toBe('expiring_soon');
    expect(res.days_to_expiry).toBe(LICENCE_EXPIRY_WARN_DAYS);
  });

  it('treats WARN_DAYS + 1 out as "valid"', () => {
    const res = licenceStatus(ymdOffset(LICENCE_EXPIRY_WARN_DAYS + 1));
    expect(res.status).toBe('valid');
    expect(res.days_to_expiry).toBe(LICENCE_EXPIRY_WARN_DAYS + 1);
  });

  it('accepts a Date object (as node-postgres returns DATE columns)', () => {
    const now = new Date();
    const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    local.setDate(local.getDate() + 10);
    const res = licenceStatus(local);
    expect(res.status).toBe('expiring_soon');
    expect(res.days_to_expiry).toBe(10);
  });
});
