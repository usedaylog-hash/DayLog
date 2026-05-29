import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBiweeklyPeriods, formatTime, roundDown5, ANCHOR, PERIOD_MS, DAY_MS } from './invoice-utils.js';

describe('getBiweeklyPeriods', () => {
  beforeEach(() => {
    // Fix time to Wednesday 2026-03-11 12:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the requested number of periods', () => {
    const periods = getBiweeklyPeriods(6);
    expect(periods).toHaveLength(6);
  });

  it('each period starts on a Monday', () => {
    const periods = getBiweeklyPeriods(3);
    for (const p of periods) {
      const day = new Date(p.start + 'T00:00:00Z').getUTCDay();
      expect(day).toBe(1); // Monday
    }
  });

  it('each period ends on a Friday (11 days after start)', () => {
    const periods = getBiweeklyPeriods(3);
    for (const p of periods) {
      const day = new Date(p.end + 'T00:00:00Z').getUTCDay();
      expect(day).toBe(5); // Friday
    }
  });

  it('returns periods in reverse chronological order', () => {
    const periods = getBiweeklyPeriods(4);
    for (let i = 1; i < periods.length; i++) {
      expect(periods[i - 1].start > periods[i].start).toBe(true);
    }
  });

  it('formats dates as YYYY-MM-DD', () => {
    const periods = getBiweeklyPeriods(1);
    expect(periods[0].start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(periods[0].end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('label combines start and end', () => {
    const periods = getBiweeklyPeriods(1);
    expect(periods[0].label).toBe(`${periods[0].start} to ${periods[0].end}`);
  });

  it('returns empty array for count 0', () => {
    expect(getBiweeklyPeriods(0)).toEqual([]);
  });
});

describe('formatTime', () => {
  it('formats a morning time with AM', () => {
    // 9:30 AM Pacific = 16:30 UTC (during PST) or 17:30 UTC (during PDT)
    const result = formatTime('2026-01-15T17:30:00Z');
    expect(result).toMatch(/9:30\s*AM/);
  });

  it('formats an afternoon time with PM', () => {
    // 2:00 PM Pacific = 22:00 UTC (during PST)
    const result = formatTime('2026-01-15T22:00:00Z');
    expect(result).toMatch(/2:00\s*PM/);
  });

  it('returns a string containing a colon (time separator)', () => {
    const result = formatTime('2026-06-15T20:00:00Z');
    expect(result).toContain(':');
  });
});

describe('roundDown5', () => {
  it('rounds 7:57 down to 7:55', () => {
    const d = new Date('2026-01-15T07:57:00');
    const result = roundDown5(d);
    expect(result.getHours()).toBe(7);
    expect(result.getMinutes()).toBe(55);
    expect(result.getSeconds()).toBe(0);
  });

  it('rounds 1:34 down to 1:30', () => {
    const d = new Date('2026-01-15T13:34:00');
    const result = roundDown5(d);
    expect(result.getMinutes()).toBe(30);
  });

  it('leaves times already on 5-minute marks unchanged', () => {
    const d = new Date('2026-01-15T09:30:00');
    const result = roundDown5(d);
    expect(result.getMinutes()).toBe(30);
  });

  it('rounds 9:01 down to 9:00', () => {
    const d = new Date('2026-01-15T09:01:44');
    const result = roundDown5(d);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it('does not mutate the original date', () => {
    const d = new Date('2026-01-15T09:13:00');
    roundDown5(d);
    expect(d.getMinutes()).toBe(13);
  });
});

describe('formatTime (rounds down)', () => {
  it('rounds 9:37 AM down to 9:35 AM', () => {
    // 9:37 AM Pacific (PST) = 17:37 UTC
    const result = formatTime('2026-01-15T17:37:00Z');
    expect(result).toMatch(/9:35\s*AM/);
  });
});

describe('constants', () => {
  it('ANCHOR is January 5, 2026', () => {
    expect(ANCHOR.getFullYear()).toBe(2026);
    expect(ANCHOR.getMonth()).toBe(0); // January
    expect(ANCHOR.getDate()).toBe(5);
  });

  it('PERIOD_MS is 14 days in milliseconds', () => {
    expect(PERIOD_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it('DAY_MS is 1 day in milliseconds', () => {
    expect(DAY_MS).toBe(86_400_000);
  });
});
