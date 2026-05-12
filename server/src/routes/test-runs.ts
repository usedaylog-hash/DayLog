import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = path.resolve(__dirname, '../../../../BlackBox/reports/history.json');

// GET /api/test-runs
router.get('/', (_req, res) => {
  try {
    const raw = fs.readFileSync(HISTORY_PATH, 'utf-8');
    const runs = JSON.parse(raw);
    // Return newest first
    res.json(runs.reverse());
  } catch (err) {
    console.error('Failed to read history.json:', err);
    res.status(500).json({ error: 'Could not load test run data' });
  }
});

export { router as testRunsRouter };
