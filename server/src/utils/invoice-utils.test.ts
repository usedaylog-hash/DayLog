import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBiweeklyPeriods, formatTime, roundToHalfHour, totalBreakMs, ANCHOR, PERIOD_MS, DAY_MS } from './invoice-utils.js';

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
  it('formats a morning time with AM (rounded to nearest half hour)', () => {
    // 9:30 AM Pacific = 17:30 UTC (during PST), stays at 9:30 AM
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

describe('roundToHalfHour', () => {
  it('rounds 7:57 up to 8:00 (nearest :00)', () => {
    const d = new Date('2026-01-15T07:57:00');
    const result = roundToHalfHour(d);
    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it('rounds 7:31 to 7:30 (nearest :30)', () => {
    const d = new Date('2026-01-15T07:31:00');
    const result = roundToHalfHour(d);
    expect(result.getHours()).toBe(7);
    expect(result.getMinutes()).toBe(30);
  });

  it('rounds 8:08 to 8:00 (nearest :00)', () => {
    const d = new Date('2026-01-15T08:08:00');
    const result = roundToHalfHour(d);
    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(0);
  });

  it('rounds 4:14 to 4:00 (nearest :00)', () => {
    const d = new Date('2026-01-15T16:14:00');
    const result = roundToHalfHour(d);
    expect(result.getHours()).toBe(16);
    expect(result.getMinutes()).toBe(0);
  });

  it('rounds 4:16 to 4:30 (nearest :30)', () => {
    const d = new Date('2026-01-15T16:16:00');
    const result = roundToHalfHour(d);
    expect(result.getHours()).toBe(16);
    expect(result.getMinutes()).toBe(30);
  });

  it('rounds 11:50 up to 12:00 (crosses hour boundary)', () => {
    const d = new Date('2026-01-15T11:50:00');
    const result = roundToHalfHour(d);
    expect(result.getHours()).toBe(12);
    expect(result.getMinutes()).toBe(0);
  });

  it('leaves times already on the hour unchanged', () => {
    const d = new Date('2026-01-15T09:00:00');
    const result = roundToHalfHour(d);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });

  it('leaves times already on :30 unchanged', () => {
    const d = new Date('2026-01-15T09:30:00');
    const result = roundToHalfHour(d);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(30);
  });

  it('does not mutate the original date', () => {
    const d = new Date('2026-01-15T09:13:00');
    roundToHalfHour(d);
    expect(d.getMinutes()).toBe(13);
  });
});

describe('formatTime (rounds to nearest half hour)', () => {
  it('rounds 9:37 AM to 9:30 AM', () => {
    // 9:37 AM Pacific (PST) = 17:37 UTC
    const result = formatTime('2026-01-15T17:37:00Z');
    expect(result).toMatch(/9:30\s*AM/);
  });
});

describe('totalBreakMs', () => {
  it('returns 0 for empty breaks array', () => {
    expect(totalBreakMs([])).toBe(0);
  });

  it('calculates time for a single completed break', () => {
    const breaks = [{
      pause_time: '2026-03-10T12:00:00Z',
      resume_time: '2026-03-10T13:00:00Z',
      reason: 'Lunch',
    }];
    expect(totalBreakMs(breaks)).toBe(3_600_000); // 1 hour
  });

  it('sums multiple breaks', () => {
    const breaks = [
      { pause_time: '2026-03-10T12:00:00Z', resume_time: '2026-03-10T13:00:00Z', reason: 'Lunch' },
      { pause_time: '2026-03-10T15:30:00Z', resume_time: '2026-03-10T16:00:00Z', reason: 'Errand' },
    ];
    expect(totalBreakMs(breaks)).toBe(5_400_000); // 1h 30m
  });

  it('uses Date.now() for open breaks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T13:00:00Z'));
    const breaks = [{
      pause_time: '2026-03-10T12:00:00Z',
      resume_time: null,
      reason: 'Lunch',
    }];
    expect(totalBreakMs(breaks)).toBe(3_600_000);
    vi.useRealTimers();
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
