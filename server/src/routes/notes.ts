import { Router } from 'express';
import { db } from '../db/connection.js';
import type { Session, Note } from '../types/index.js';

const router = Router();

// POST /api/notes
router.post('/', (req, res) => {
  const { content } = req.body;

  if (!content || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'Content is required' });
    return;
  }

  const session = db.prepare(
    'SELECT * FROM sessions WHERE clock_out IS NULL'
  ).get() as Session | undefined;

  if (!session) {
    res.status(400).json({ error: 'Not clocked in — clock in first' });
    return;
  }

  const now = new Date().toISOString();
  const result = db.prepare(
    'INSERT INTO notes (session_id, content, timestamp) VALUES (?, ?, ?)'
  ).run(session.id, content.trim(), now);

  const note = db.prepare(
    'SELECT * FROM notes WHERE id = ?'
  ).get(result.lastInsertRowid) as Note;

  res.status(201).json(note);
});

export { router as notesRouter };
