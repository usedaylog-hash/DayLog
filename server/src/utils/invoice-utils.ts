// Biweekly anchor: Monday 2026-01-05
export const ANCHOR = new Date('2026-01-05T00:00:00');
export const PERIOD_MS = 14 * 24 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export interface LineItem {
  date: string;
  location: string;
  description: string;
  hours: number;
  rate: number;
  amount: number;
}

export function getBiweeklyPeriods(count: number): Array<{ start: string; end: string; label: string }> {
  const now = Date.now();
  const elapsed = now - ANCHOR.getTime();
  const currentIndex = Math.floor(elapsed / PERIOD_MS);

  const periods: Array<{ start: string; end: string; label: string }> = [];
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  for (let i = 0; i < count; i++) {
    const idx = currentIndex - i;
    const start = new Date(ANCHOR.getTime() + idx * PERIOD_MS); // Monday
    const end = new Date(start.getTime() + 11 * DAY_MS); // Friday of second week (day 11 = +11 days from Monday)
    periods.push({
      start: fmt(start),
      end: fmt(end),
      label: `${fmt(start)} to ${fmt(end)}`,
    });
  }
  return periods;
}

/** Round a Date down to the nearest 5-minute mark. */
export function roundDown5(d: Date): Date {
  const result = new Date(d);
  result.setMinutes(Math.floor(result.getMinutes() / 5) * 5, 0, 0);
  return result;
}

export function formatTime(iso: string): string {
  const d = roundDown5(new Date(iso));
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
}
