import { Router } from 'express';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/connection.js';
import type { Session } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLACKBOX_DIR = path.resolve(__dirname, '../../../../BlackBox');

const router = Router();

export interface Commit {
  id: number;
  session_id: number;
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  comment: string | null;
  created_at: string;
}

/**
 * Sweep git log for commits since session start and insert new ones.
 * Returns all commits for the session.
 */
export function sweepCommits(session: Session): Commit[] {
  try {
    const output = execSync(
      `git log --after="${session.clock_in}" --format="%H%n%s%n%an%n%aI" --reverse`,
      { cwd: BLACKBOX_DIR, encoding: 'utf-8', timeout: 5000 }
    );

    const lines = output.trim().split('\n');
    if (lines.length >= 4) {
      const insert = db.prepare(
        'INSERT OR IGNORE INTO commits (session_id, hash, message, author, timestamp) VALUES (?, ?, ?, ?, ?)'
      );
      const insertMany = db.transaction(() => {
        for (let i = 0; i + 3 < lines.length; i += 4) {
          const hash = lines[i];
          const message = lines[i + 1];
          const author = lines[i + 2];
          const timestamp = lines[i + 3];
          insert.run(session.id, hash, message, author, timestamp);
        }
      });
      insertMany();
    }
  } catch {
    // git command failed — repo may not exist or no commits match
  }

  return db.prepare(
    'SELECT * FROM commits WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(session.id) as Commit[];
}

// GET /api/sessions/current/commits
router.get('/sessions/current/commits', (_req, res) => {
  const session = db.prepare(
    'SELECT * FROM sessions WHERE clock_out IS NULL'
  ).get() as Session | undefined;

  if (!session) {
    res.json([]);
    return;
  }

  const commits = sweepCommits(session);
  res.json(commits);
});

// PATCH /api/commits/:id/comment
router.patch('/commits/:id/comment', (req, res) => {
  const { comment } = req.body;
  if (typeof comment !== 'string') {
    res.status(400).json({ error: 'comment must be a string' });
    return;
  }

  const result = db.prepare(
    'UPDATE commits SET comment = ? WHERE id = ?'
  ).run(comment || null, req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Commit not found' });
    return;
  }

  res.json({ ok: true });
});

export { router as commitsRouter };
