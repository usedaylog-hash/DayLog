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

// GET /api/test-runs/:filename
router.get('/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename format to prevent path traversal
    if (!/^regression-.+-\d{8}-\d{6}\.txt$/.test(filename)) {
      res.status(400).json({ error: 'Invalid filename format' });
      return;
    }

    const filepath = path.join(REPORTS_DIR, filename);
    if (!fs.existsSync(filepath)) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const run = parseRegressionFile(filepath, filename);
    if (!run) {
      res.status(500).json({ error: 'Could not parse report' });
      return;
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n');

    // Parse skipped tests from lines starting with "  -"
    const skippedTests: string[] = [];
    for (const line of lines) {
      const skipMatch = line.match(/^  -\s+\d+\s+(.+)$/);
      if (skipMatch) {
        skippedTests.push(skipMatch[1].trim());
      }
    }

    // Parse error detail blocks: each starts with "  N) [browser] › ..."
    // and continues until the next numbered block or "  Slow test file:" or summary lines
    const failedTestDetails: { name: string; error: string }[] = [];
    const errorBlockStart = /^  (\d+)\) (.+)$/;
    const blockEnd = /^  (Slow test file:|\d+ failed$|\d+ skipped$|\d+ passed)/;

    let i = 0;
    while (i < lines.length) {
      const startMatch = lines[i].match(errorBlockStart);
      if (startMatch) {
        const name = startMatch[2].trim();
        const errorLines: string[] = [];
        i++;
        while (i < lines.length) {
          if (errorBlockStart.test(lines[i]) || blockEnd.test(lines[i])) break;
          errorLines.push(lines[i]);
          i++;
        }
        // Trim leading/trailing blank lines from error block
        while (errorLines.length > 0 && errorLines[0].trim() === '') errorLines.shift();
        while (errorLines.length > 0 && errorLines[errorLines.length - 1].trim() === '') errorLines.pop();
        failedTestDetails.push({ name, error: errorLines.join('\n') });
      } else {
        i++;
      }
    }

    // Strip ANSI escape codes from error text
    const ansiRegex = /\x1b\[\d+m/g;
    for (const detail of failedTestDetails) {
      detail.error = detail.error.replace(ansiRegex, '');
    }

    res.json({ ...run, failedTestDetails, skippedTests });
  } catch (err) {
    console.error('Failed to read regression file:', err);
    res.status(500).json({ error: 'Could not load test run detail' });
  }
});

export { router as testRunsRouter };
