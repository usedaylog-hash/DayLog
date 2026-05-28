import { describe, it, expect } from 'vitest';
import { generateSummary, generateHandoff } from './session-utils.js';
import type { NoteInput, CommitInput } from './session-utils.js';

const clockIn = '2026-03-10T09:00:00Z';
const clockOut = '2026-03-10T11:30:00Z'; // 2h 30m

const makeCommit = (overrides?: Partial<CommitInput>): CommitInput => ({
  hash: 'abc1234def5678',
  message: 'Fix the thing',
  comment: null,
  ...overrides,
});

const makeNote = (overrides?: Partial<NoteInput>): NoteInput => ({
  content: 'Started working on feature',
  timestamp: '2026-03-10T09:15:00Z',
  ...overrides,
});

describe('generateSummary', () => {
  it('includes duration line', () => {
    const result = generateSummary(clockIn, clockOut, [], []);
    expect(result).toContain('Session: 2h 30m');
  });

  it('shows commit count (plural)', () => {
    const commits = [makeCommit(), makeCommit({ hash: 'bbb2222ccc3333' })];
    const result = generateSummary(clockIn, clockOut, [], commits);
    expect(result).toContain('2 commits');
  });

  it('shows commit count (singular)', () => {
    const result = generateSummary(clockIn, clockOut, [], [makeCommit()]);
    expect(result).toContain('1 commit');
    expect(result).not.toContain('1 commits');
  });

  it('shows note count (plural)', () => {
    const notes = [makeNote(), makeNote({ content: 'Another note' })];
    const result = generateSummary(clockIn, clockOut, notes, []);
    expect(result).toContain('2 notes');
  });

  it('shows note count (singular)', () => {
    const result = generateSummary(clockIn, clockOut, [makeNote()], []);
    expect(result).toContain('1 note');
    expect(result).not.toContain('1 notes');
  });

  it('includes short commit hashes (7 chars)', () => {
    const result = generateSummary(clockIn, clockOut, [], [makeCommit()]);
    expect(result).toContain('abc1234');
    expect(result).not.toContain('abc1234def5678');
  });

  it('includes commit comments with em dash separator', () => {
    const result = generateSummary(clockIn, clockOut, [], [
      makeCommit({ comment: 'Important context' }),
    ]);
    expect(result).toContain('— Important context');
  });

  it('includes note timestamps in brackets', () => {
    const result = generateSummary(clockIn, clockOut, [makeNote()], []);
    expect(result).toMatch(/\[\d{2}:\d{2}(:\d{2})?\s*(AM|PM)?\]/);
  });

  it('handles zero commits and notes', () => {
    const result = generateSummary(clockIn, clockOut, [], []);
    expect(result).toContain('Session:');
    expect(result).not.toContain('commit');
    expect(result).not.toContain('note');
  });

  it('shows minutes-only duration for sub-hour sessions', () => {
    const result = generateSummary('2026-03-10T09:00:00Z', '2026-03-10T09:45:00Z', [], []);
    expect(result).toContain('Session: 45m');
    expect(result).not.toContain('h');
  });
});

describe('generateHandoff', () => {
  it('starts with handoff header', () => {
    const result = generateHandoff(clockIn, clockOut, []);
    expect(result).toContain('# Last Session Handoff');
  });

  it('includes date line', () => {
    const result = generateHandoff(clockIn, clockOut, []);
    expect(result).toContain('**Date:**');
  });

  it('includes duration', () => {
    const result = generateHandoff(clockIn, clockOut, []);
    expect(result).toContain('**Duration:** 2h 30m');
  });

  it('includes commit bullets with backtick-wrapped short hashes', () => {
    const result = generateHandoff(clockIn, clockOut, [makeCommit()]);
    expect(result).toContain('- `abc1234` Fix the thing');
  });

  it('includes commit comment as sub-bullet with italics', () => {
    const result = generateHandoff(clockIn, clockOut, [
      makeCommit({ comment: 'Needs review' }),
    ]);
    expect(result).toContain('  - _Needs review_');
  });

  it('includes handoff note under "What\'s Still Open"', () => {
    const result = generateHandoff(clockIn, clockOut, [], 'Need to finish auth');
    expect(result).toContain("## What's Still Open");
    expect(result).toContain('Need to finish auth');
  });

  it('omits handoff note section when note is undefined', () => {
    const result = generateHandoff(clockIn, clockOut, []);
    expect(result).not.toContain("What's Still Open");
  });

  it('omits handoff note section when note is empty/whitespace', () => {
    const result = generateHandoff(clockIn, clockOut, [], '   ');
    expect(result).not.toContain("What's Still Open");
  });

  it('ends with a newline', () => {
    const result = generateHandoff(clockIn, clockOut, []);
    expect(result.endsWith('\n')).toBe(true);
  });
});
