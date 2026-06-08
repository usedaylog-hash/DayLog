import { Router } from 'express';
import fs from 'fs';
import { db } from '../db/connection.js';
import type { Session, Note, SessionBreak, SessionWithNotes } from '../types/index.js';
import { sweepCommits } from './commits.js';
import type { Commit } from './commits.js';
import { generateSummary, generateHandoff } from '../utils/session-utils.js';

const LAST_SESSION_PATH = '/home/luke/MyCode/src/BlackBox/LAST-SESSION.md';

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

  res.status(201).json({ ...session, notes: [], commits: [], breaks: [] });
});

// POST /api/sessions/clock-out
router.post('/clock-out', (req, res) => {
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

  // Auto-close any active break
  db.prepare(
    'UPDATE session_breaks SET resume_time = ? WHERE session_id = ? AND resume_time IS NULL'
  ).run(now, session.id);

  const breaks = db.prepare(
    'SELECT * FROM session_breaks WHERE session_id = ? ORDER BY pause_time ASC'
  ).all(session.id) as SessionBreak[];

  const summary = generateSummary(session.clock_in, now, notes, commits, breaks);
  const handoffNote = req.body?.handoffNote as string | undefined;
  const handoff = generateHandoff(session.clock_in, now, commits, handoffNote, breaks);

  db.prepare(
    'UPDATE sessions SET clock_out = ?, summary = ?, handoff = ? WHERE id = ?'
  ).run(now, summary, handoff, session.id);

  writeLastSessionFile(handoff);

  const updated = db.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  ).get(session.id) as Session;

  res.json({ ...updated, notes, commits, breaks });
});

// GET /api/sessions/last-handoff
router.get('/last-handoff', (_req, res) => {
  const row = db.prepare(
    'SELECT handoff FROM sessions WHERE clock_out IS NOT NULL ORDER BY clock_out DESC LIMIT 1'
  ).get() as { handoff: string | null } | undefined;

  res.json({ handoff: row?.handoff ?? null });
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

  const breaks = db.prepare(
    'SELECT * FROM session_breaks WHERE session_id = ? ORDER BY pause_time ASC'
  ).all(session.id) as SessionBreak[];

  res.json({ ...session, notes, commits, breaks });
});

// POST /api/sessions/pause
router.post('/pause', (req, res) => {
  const session = db.prepare(
    'SELECT * FROM sessions WHERE clock_out IS NULL'
  ).get() as Session | undefined;

  if (!session) {
    res.status(400).json({ error: 'Not clocked in' });
    return;
  }

  // Check if already paused
  const activeBreak = db.prepare(
    'SELECT * FROM session_breaks WHERE session_id = ? AND resume_time IS NULL'
  ).get(session.id) as SessionBreak | undefined;

  if (activeBreak) {
    res.status(400).json({ error: 'Already paused' });
    return;
  }

  const now = new Date().toISOString();
  const reason = (req.body?.reason as string) || '';

  db.prepare(
    'INSERT INTO session_breaks (session_id, pause_time, reason) VALUES (?, ?, ?)'
  ).run(session.id, now, reason);

  const breaks = db.prepare(
    'SELECT * FROM session_breaks WHERE session_id = ? ORDER BY pause_time ASC'
  ).all(session.id) as SessionBreak[];

  const notes = db.prepare(
    'SELECT * FROM notes WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(session.id) as Note[];

  const commits = db.prepare(
    'SELECT * FROM commits WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(session.id) as Commit[];

  res.json({ ...session, notes, commits, breaks });
});

// POST /api/sessions/resume
router.post('/resume', (_req, res) => {
  const session = db.prepare(
    'SELECT * FROM sessions WHERE clock_out IS NULL'
  ).get() as Session | undefined;

  if (!session) {
    res.status(400).json({ error: 'Not clocked in' });
    return;
  }

  const activeBreak = db.prepare(
    'SELECT * FROM session_breaks WHERE session_id = ? AND resume_time IS NULL'
  ).get(session.id) as SessionBreak | undefined;

  if (!activeBreak) {
    res.status(400).json({ error: 'Not paused' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE session_breaks SET resume_time = ? WHERE id = ?'
  ).run(now, activeBreak.id);

  const breaks = db.prepare(
    'SELECT * FROM session_breaks WHERE session_id = ? ORDER BY pause_time ASC'
  ).all(session.id) as SessionBreak[];

  const notes = db.prepare(
    'SELECT * FROM notes WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(session.id) as Note[];

  const commits = db.prepare(
    'SELECT * FROM commits WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(session.id) as Commit[];

  res.json({ ...session, notes, commits, breaks });
});

// DELETE /api/sessions/breaks/:id
router.delete('/breaks/:id', (req, res) => {
  const brk = db.prepare(
    'SELECT * FROM session_breaks WHERE id = ?'
  ).get(req.params.id) as SessionBreak | undefined;

  if (!brk) {
    res.status(404).json({ error: 'Break not found' });
    return;
  }

  db.prepare('DELETE FROM session_breaks WHERE id = ?').run(brk.id);
  res.json({ ok: true });
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
    const breaks = db.prepare(
      'SELECT * FROM session_breaks WHERE session_id = ? ORDER BY pause_time ASC'
    ).all(s.id) as SessionBreak[];
    return { ...s, notes, commits, breaks };
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

  db.prepare('DELETE FROM session_breaks WHERE session_id = ?').run(session.id);
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

  const breaks = db.prepare(
    'SELECT * FROM session_breaks WHERE session_id = ? ORDER BY pause_time ASC'
  ).all(session.id) as SessionBreak[];

  res.json({ ...session, notes, commits, breaks });
});

function writeLastSessionFile(handoff: string): void {
  try {
    fs.writeFileSync(LAST_SESSION_PATH, handoff, 'utf-8');
  } catch (err) {
    console.error('Failed to write LAST-SESSION.md:', err);
  }
}

export { router as sessionsRouter };
