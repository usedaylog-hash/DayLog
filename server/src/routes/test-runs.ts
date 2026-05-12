import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.resolve(__dirname, '../../../../BlackBox/reports');

interface CronRun {
  timestamp: string;
  environment: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: string;
  failedTests: string[];
  filename: string;
}

function parseRegressionFile(filepath: string, filename: string): CronRun | null {
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n');

    // Parse filename: regression-{env}-{YYYYMMDD}-{HHMMSS}.txt
    const match = filename.match(/^regression-(.+)-(\d{8})-(\d{6})\.txt$/);
    if (!match) return null;

    const env = match[1];
    const dateStr = match[2];
    const timeStr = match[3];
    const timestamp = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}T${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`;

    // Parse summary from the tail of the file (scan forward through last ~50 lines)
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let duration = '';
    const failedTests: string[] = [];
    let inFailedSection = false;

    const tail = lines.slice(-50);
    for (const rawLine of tail) {
      const line = rawLine.trim();

      const passedMatch = line.match(/^(\d+) passed \((.+)\)$/);
      if (passedMatch) {
        passed = parseInt(passedMatch[1]);
        duration = passedMatch[2];
        inFailedSection = false;
        continue;
      }

      const failedMatch = line.match(/^(\d+) failed$/);
      if (failedMatch) {
        failed = parseInt(failedMatch[1]);
        inFailedSection = true;
        continue;
      }

      const skippedMatch = line.match(/^(\d+) skipped$/);
      if (skippedMatch) {
        skipped = parseInt(skippedMatch[1]);
        inFailedSection = false;
        continue;
      }

      // Failed test lines are indented under "X failed"
      if (inFailedSection && line.startsWith('[')) {
        // Format: [chromium] › tests/specs/file.spec.ts:line:col › Suite › TC-XXX: Title @tags
        const testMatch = line.match(/› (TC-.+?)$/);
        if (testMatch) {
          failedTests.push(testMatch[1]);
        } else {
          failedTests.push(line);
        }
        continue;
      }
    }

    // Parse total from the first line
    let total = 0;
    const totalMatch = content.match(/Running (\d+) tests/);
    if (totalMatch) {
      total = parseInt(totalMatch[1]);
    }

    return {
      timestamp,
      environment: env,
      total,
      passed,
      failed,
      skipped,
      duration,
      failedTests,
      filename,
    };
  } catch {
    return null;
  }
}

// GET /api/test-runs
router.get('/', (_req, res) => {
  try {
    const files = fs.readdirSync(REPORTS_DIR)
      .filter((f) => f.startsWith('regression-') && f.endsWith('.txt'))
      .sort()
      .reverse();

    const runs: CronRun[] = [];
    for (const file of files) {
      const run = parseRegressionFile(path.join(REPORTS_DIR, file), file);
      if (run) runs.push(run);
    }

    res.json(runs);
  } catch (err) {
    console.error('Failed to read regression files:', err);
    res.status(500).json({ error: 'Could not load test run data' });
  }
});

export { router as testRunsRouter };
