import { describe, it, expect } from 'vitest';
import { formatDuration, formatDurationMs, extractActivity, parseBugContent } from './portfolio-utils.js';

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration('2026-03-10T09:00:00Z', '2026-03-10T11:30:00Z')).toBe('2h 30m');
  });

  it('formats minutes only for sub-hour durations', () => {
    expect(formatDuration('2026-03-10T09:00:00Z', '2026-03-10T09:45:00Z')).toBe('45m');
  });

  it('shows 0m for zero duration', () => {
    expect(formatDuration('2026-03-10T09:00:00Z', '2026-03-10T09:00:00Z')).toBe('0m');
  });

  it('handles multi-hour durations', () => {
    expect(formatDuration('2026-03-10T08:00:00Z', '2026-03-10T16:00:00Z')).toBe('8h 0m');
  });
});

describe('formatDurationMs', () => {
  it('formats hours and minutes from milliseconds', () => {
    expect(formatDurationMs(2 * 3_600_000 + 30 * 60_000)).toBe('2h 30m');
  });

  it('formats minutes only for sub-hour values', () => {
    expect(formatDurationMs(45 * 60_000)).toBe('45m');
  });

  it('shows 0m for zero', () => {
    expect(formatDurationMs(0)).toBe('0m');
  });
});

describe('extractActivity', () => {
  it('returns first non-empty non-Session line', () => {
    const summary = 'Session: 2h 30m\n3 commits\n\nabc1234 Fix the bug';
    expect(extractActivity(summary)).toBe('3 commits');
  });

  it('skips Session: line', () => {
    const summary = 'Session: 1h 0m\nDid some work';
    expect(extractActivity(summary)).toBe('Did some work');
  });

  it('returns empty string for null', () => {
    expect(extractActivity(null)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(extractActivity('')).toBe('');
  });

  it('returns empty string when only Session: line exists', () => {
    expect(extractActivity('Session: 1h 0m')).toBe('');
  });
});

describe('parseBugContent', () => {
  const bugMarkdown = `# Bug Report: Fuel form crashes on empty input

**Date:** 2026-03-10
**Severity:** High
**Environment:** Chrome 120, macOS
**Reporter:** Luke

### Summary

The fuel form throws an unhandled error when submitted without values.

## Steps to Reproduce

1. Open fuel form
2. Click submit
`;

  const findingMarkdown = `# AI Usage chart axis labels overlap

**Date:** 2026-03-12
**Environment:** Firefox 121

### Summary

The x-axis labels on the AI usage chart overlap when there are more than 10 data points.
`;

  it('extracts the title from the heading', () => {
    const result = parseBugContent(bugMarkdown, 'BUG-2026-03-10-fuel-crash.md');
    expect(result?.title).toBe('Fuel form crashes on empty input');
  });

  it('extracts the date', () => {
    const result = parseBugContent(bugMarkdown, 'BUG-2026-03-10-fuel-crash.md');
    expect(result?.date).toBe('2026-03-10');
  });

  it('extracts the severity', () => {
    const result = parseBugContent(bugMarkdown, 'BUG-2026-03-10-fuel-crash.md');
    expect(result?.severity).toBe('High');
  });

  it('defaults severity to Info when not present', () => {
    const result = parseBugContent(findingMarkdown, 'FINDING-2026-03-12-ai-usage-overlap.md');
    expect(result?.severity).toBe('Info');
  });

  it('extracts the environment', () => {
    const result = parseBugContent(bugMarkdown, 'BUG-2026-03-10-fuel-crash.md');
    expect(result?.environment).toBe('Chrome 120, macOS');
  });

  it('extracts the reporter', () => {
    const result = parseBugContent(bugMarkdown, 'BUG-2026-03-10-fuel-crash.md');
    expect(result?.reporter).toBe('Luke');
  });

  it('defaults reporter to Luke when not present', () => {
    const result = parseBugContent(findingMarkdown, 'FINDING-2026-03-12-ai-usage-overlap.md');
    expect(result?.reporter).toBe('Luke');
  });

  it('maps fuel slug to Fuel Records area', () => {
    const result = parseBugContent(bugMarkdown, 'BUG-2026-03-10-fuel-crash.md');
    expect(result?.featureArea).toBe('Fuel Records');
  });

  it('maps ai-usage slug to AI Usage Analytics area', () => {
    const result = parseBugContent(findingMarkdown, 'FINDING-2026-03-12-ai-usage-overlap.md');
    expect(result?.featureArea).toBe('AI Usage Analytics');
  });

  it('capitalizes unknown slug as fallback area', () => {
    const result = parseBugContent(bugMarkdown, 'BUG-2026-03-10-dashboard-issue.md');
    expect(result?.featureArea).toBe('Dashboard');
  });

  it('returns General for non-matching filename pattern', () => {
    const result = parseBugContent(bugMarkdown, 'random-file.md');
    expect(result?.featureArea).toBe('General');
  });

  it('extracts the summary first line', () => {
    const result = parseBugContent(bugMarkdown, 'BUG-2026-03-10-fuel-crash.md');
    expect(result?.summary).toBe('The fuel form throws an unhandled error when submitted without values.');
  });

  it('preserves the filename', () => {
    const result = parseBugContent(bugMarkdown, 'BUG-2026-03-10-fuel-crash.md');
    expect(result?.filename).toBe('BUG-2026-03-10-fuel-crash.md');
  });

  it('maps edit-fuel slug to Fuel Records area', () => {
    const result = parseBugContent(bugMarkdown, 'BUG-2026-03-10-edit-fuel-crash.md');
    expect(result?.featureArea).toBe('Fuel Records');
  });

  it('maps admin slug to Admin Panel area', () => {
    const result = parseBugContent(bugMarkdown, 'BUG-2026-03-10-admin-error.md');
    expect(result?.featureArea).toBe('Admin Panel');
  });
});
