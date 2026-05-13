import { Router } from 'express';
import { db } from '../db/connection.js';
import type { Session, Note, SessionWithNotes } from '../types/index.js';
import { sweepCommits } from './commits.js';
import type { Commit } from './commits.js';

const router = Router();

// POST /api/sessions/clock-in
router.post('/clock-in', (_req, res) => {
  // Check if there's already an active session
  const existing = db.prepare(
    'SELECT * FROM sessions WHERE clock_out IS NULL'
  ).get() as Session | undefined;

  if (existing) {
    res.status(400).json({ error: 'Already clocked in' });
    return;
  }

  const now = new Date().toISOString();
  const result = db.prepare(
    'INSERT INTO sessions (clock_in) VALUES (?)'
  ).run(now);

  const session = db.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  ).get(result.lastInsertRowid) as Session;

  res.status(201).json({ ...session, notes: [], commits: [] });
});

// POST /api/sessions/clock-out
router.post('/clock-out', (_req, res) => {
  const session = db.prepare(
    'SELECT * FROM sessions WHERE clock_out IS NULL'
  ).get() as Session | undefined;

  if (!session) {
    res.status(400).json({ error: 'Not clocked in' });
    return;
  }

  const notes = db.prepare(
    'SELECT * FROM notes WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(session.id) as Note[];

  // Final sweep for any last-moment commits
  const commits = sweepCommits(session);

  const now = new Date().toISOString();
  const summary = generateSummary(session.clock_in, now, notes, commits);

  db.prepare(
    'UPDATE sessions SET clock_out = ?, summary = ? WHERE id = ?'
  ).run(now, summary, session.id);

  const updated = db.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  ).get(session.id) as Session;

  res.json({ ...updated, notes, commits });
});

// GET /api/sessions/current
router.get('/current', (_req, res) => {
  const session = db.prepare(
    'SELECT * FROM sessions WHERE clock_out IS NULL'
  ).get() as Session | undefined;

  if (!session) {
    res.json(null);
    return;
  }

  const notes = db.prepare(
    'SELECT * FROM notes WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(session.id) as Note[];

  const commits = db.prepare(
    'SELECT * FROM commits WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(session.id) as Commit[];

  res.json({ ...session, notes, commits });
});

// GET /api/sessions
router.get('/', (_req, res) => {
  const sessions = db.prepare(
    'SELECT * FROM sessions WHERE clock_out IS NOT NULL ORDER BY clock_in DESC'
  ).all() as Session[];

  const result: SessionWithNotes[] = sessions.map((s) => {
    const notes = db.prepare(
      'SELECT * FROM notes WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(s.id) as Note[];
    const commits = db.prepare(
      'SELECT * FROM commits WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(s.id) as Commit[];
    return { ...s, notes, commits };
  });

  res.json(result);
});

// DELETE /api/sessions/:id
router.delete('/:id', (req, res) => {
  const session = db.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  ).get(req.params.id) as Session | undefined;

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  db.prepare('DELETE FROM commits WHERE session_id = ?').run(session.id);
  db.prepare('DELETE FROM notes WHERE session_id = ?').run(session.id);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);

  res.json({ ok: true });
});

// GET /api/sessions/:id
router.get('/:id', (req, res) => {
  const session = db.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  ).get(req.params.id) as Session | undefined;

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const notes = db.prepare(
    'SELECT * FROM notes WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(session.id) as Note[];

  const commits = db.prepare(
    'SELECT * FROM commits WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(session.id) as Commit[];

  res.json({ ...session, notes, commits });
});

function generateSummary(clockIn: string, clockOut: string, notes: Note[], commits: Commit[] = []): string {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  const ms = end.getTime() - start.getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);

  const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const lines = [
    `Session: ${duration}`,
  ];

  if (commits.length > 0) {
    lines.push(`${commits.length} commit${commits.length !== 1 ? 's' : ''}`);
  }
  if (notes.length > 0) {
    lines.push(`${notes.length} note${notes.length !== 1 ? 's' : ''}`);
  }
  lines.push('');

  for (const commit of commits) {
    const short = commit.hash.slice(0, 7);
    const line = `${short} ${commit.message}`;
    lines.push(commit.comment ? `${line} — ${commit.comment}` : line);
  }

  for (const note of notes) {
    const time = new Date(note.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    lines.push(`[${time}] ${note.content}`);
  }

  return lines.join('\n');
}

export { router as sessionsRouter };
