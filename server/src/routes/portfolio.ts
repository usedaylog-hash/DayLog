import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { db } from '../db/connection.js';
import { formatDuration, formatDurationMs, extractActivity, parseBugContent } from '../utils/portfolio-utils.js';
import type { BugReport } from '../utils/portfolio-utils.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLACKBOX_DIR = path.resolve(__dirname, '../../../../BlackBox');
const BUGS_DIR = path.join(BLACKBOX_DIR, 'bugs');
const REPORTS_DIR = path.join(BLACKBOX_DIR, 'reports');

interface PortfolioSession {
  id: number;
  date: string;
  duration: string;
  commitCount: number;
  noteCount: number;
  summary: string | null;
  activity: string;
}

interface TestRunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  runCount: number;
}

interface PortfolioData {
  stats: {
    totalHours: string;
    sessionCount: number;
    commitCount: number;
    bugsFound: number;
    testRuns: number;
    passRate: number;
  };
  sessions: PortfolioSession[];
  bugs: BugReport[];
}

function parseBugFile(filepath: string, filename: string): BugReport | null {
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    return parseBugContent(content, filename);
  } catch {
    return null;
  }
}

function getTestRunStats(): TestRunSummary {
  const stats: TestRunSummary = { total: 0, passed: 0, failed: 0, skipped: 0, runCount: 0 };

  try {
    const files = fs.readdirSync(REPORTS_DIR)
      .filter((f) => f.startsWith('regression-') && f.endsWith('.txt'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(REPORTS_DIR, file), 'utf-8');
      const lines = content.split('\n');
      const tail = lines.slice(-50);

      let runPassed = 0;
      let runFailed = 0;
      let runSkipped = 0;

      for (const rawLine of tail) {
        const line = rawLine.trim();
        const pm = line.match(/^(\d+) passed/);
        if (pm) runPassed = parseInt(pm[1]);
        const fm = line.match(/^(\d+) failed$/);
        if (fm) runFailed = parseInt(fm[1]);
        const sm = line.match(/^(\d+) skipped$/);
        if (sm) runSkipped = parseInt(sm[1]);
      }

      const totalMatch = content.match(/Running (\d+) tests/);
      const runTotal = totalMatch ? parseInt(totalMatch[1]) : runPassed + runFailed + runSkipped;

      stats.total += runTotal;
      stats.passed += runPassed;
      stats.failed += runFailed;
      stats.skipped += runSkipped;
      stats.runCount++;
    }
  } catch {
    // Reports dir may not exist
  }

  return stats;
}

function getPortfolioData(): PortfolioData {
  // Sessions from DB
  const sessions = db.prepare(
    'SELECT * FROM sessions WHERE clock_out IS NOT NULL ORDER BY clock_in DESC'
  ).all() as Array<{ id: number; clock_in: string; clock_out: string; summary: string | null }>;

  const totalCommits = (db.prepare(
    'SELECT COUNT(*) as count FROM commits'
  ).get() as { count: number }).count;

  // Batch counts with GROUP BY instead of N+1 queries
  const commitCounts = new Map<number, number>();
  const commitRows = db.prepare(
    'SELECT session_id, COUNT(*) as count FROM commits GROUP BY session_id'
  ).all() as Array<{ session_id: number; count: number }>;
  for (const row of commitRows) {
    commitCounts.set(row.session_id, row.count);
  }

  const noteCounts = new Map<number, number>();
  const noteRows = db.prepare(
    'SELECT session_id, COUNT(*) as count FROM notes GROUP BY session_id'
  ).all() as Array<{ session_id: number; count: number }>;
  for (const row of noteRows) {
    noteCounts.set(row.session_id, row.count);
  }

  let totalMs = 0;
  const portfolioSessions: PortfolioSession[] = sessions.map((s) => {
    const ms = new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime();
    totalMs += ms;

    return {
      id: s.id,
      date: s.clock_in,
      duration: formatDuration(s.clock_in, s.clock_out),
      commitCount: commitCounts.get(s.id) || 0,
      noteCount: noteCounts.get(s.id) || 0,
      summary: s.summary,
      activity: extractActivity(s.summary),
    };
  });

  // Parse bug reports — sorted descending (most recent first)
  const bugs: BugReport[] = [];
  try {
    const bugFiles = fs.readdirSync(BUGS_DIR)
      .filter((f) => (f.startsWith('BUG-') || f.startsWith('FINDING-')) && f.endsWith('.md'))
      .sort()
      .reverse();

    for (const file of bugFiles) {
      const bug = parseBugFile(path.join(BUGS_DIR, file), file);
      if (bug) bugs.push(bug);
    }
  } catch {
    // Bugs dir may not exist
  }

  // Test run stats
  const testStats = getTestRunStats();
  const passRate = testStats.total > 0
    ? Math.round((testStats.passed / testStats.total) * 100)
    : 0;

  return {
    stats: {
      totalHours: formatDurationMs(totalMs),
      sessionCount: sessions.length,
      commitCount: totalCommits,
      bugsFound: bugs.length,
      testRuns: testStats.runCount,
      passRate,
    },
    sessions: portfolioSessions,
    bugs,
  };
}

// GET /api/portfolio
router.get('/', (_req, res) => {
  try {
    const data = getPortfolioData();
    res.json(data);
  } catch (err) {
    console.error('Failed to build portfolio data:', err);
    res.status(500).json({ error: 'Could not load portfolio data' });
  }
});

// GET /api/portfolio/pdf
router.get('/pdf', (_req, res) => {
  try {
    const { stats, sessions, bugs } = getPortfolioData();

    // Build PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="luke-qa-portfolio.pdf"');
    doc.pipe(res);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('QA Engineering Portfolio', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(14).font('Helvetica').text('Luke — VOXCAR QA', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#666')
      .text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'center' });
    doc.moveDown(1.5);

    // Stats section
    doc.fillColor('#000').fontSize(16).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');

    const statsLines = [
      `Total Time Logged: ${stats.totalHours}`,
      `Work Sessions: ${stats.sessionCount}`,
      `Commits: ${stats.commitCount}`,
      `Bugs Reported: ${stats.bugsFound}`,
      `Test Runs: ${stats.testRuns}`,
      `Overall Pass Rate: ${stats.passRate}%`,
    ];
    for (const line of statsLines) {
      doc.text(`  •  ${line}`);
    }
    doc.moveDown(1);

    // Bug highlights
    if (bugs.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('Bugs & Findings Reported');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      for (const bug of bugs) {
        if (doc.y > 700) doc.addPage();

        const severityLabel = `[${bug.severity}]`;
        doc.font('Helvetica-Bold').text(`${severityLabel} ${bug.title}`, { continued: false });
        doc.font('Helvetica').fillColor('#444')
          .text(`   ${bug.date}  •  ${bug.featureArea}  •  ${bug.environment || 'N/A'}`);
        if (bug.summary) {
          doc.fillColor('#333').text(`   ${bug.summary}`);
        }
        doc.fillColor('#000').moveDown(0.4);
      }
      doc.moveDown(0.5);
    }

    // Session history — no row cap, page breaks handled by pdfkit
    if (sessions.length > 0) {
      if (doc.y > 650) doc.addPage();

      doc.fontSize(16).font('Helvetica-Bold').text('Session History');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      // Table header
      const col1 = 50;  // date
      const col2 = 170; // duration
      const col3 = 240; // commits
      const col4 = 310; // summary

      doc.font('Helvetica-Bold');
      doc.text('Date', col1, doc.y, { continued: false });
      const headerY = doc.y - doc.currentLineHeight();
      doc.text('Duration', col2, headerY);
      doc.text('Commits', col3, headerY);
      doc.text('Activity', col4, headerY);
      doc.moveDown(0.3);

      // Draw line
      doc.moveTo(col1, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);

      doc.font('Helvetica');
      for (const s of sessions) {
        if (doc.y > 750) doc.addPage();

        const dateStr = new Date(s.date).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        });

        doc.text(dateStr, col1, doc.y, { width: 110 });
        const lineY = doc.y - doc.currentLineHeight();
        doc.text(s.duration, col2, lineY, { width: 60 });
        doc.text(String(s.commitCount), col3, lineY, { width: 60 });
        doc.text(s.activity.slice(0, 50), col4, lineY, { width: 235 });
        doc.moveDown(0.2);
      }
      doc.moveDown(1);
    }

    // Skills section
    if (doc.y > 650) doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Skills & Tools');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    const skills = [
      'Playwright E2E Test Automation',
      'API Testing & Regression Testing',
      'Bug Reporting & Root Cause Analysis',
      'Cross-browser Testing (Chromium, Firefox, WebKit)',
      'CI/CD Integration & Test Scheduling',
      'TypeScript, Node.js, SQLite',
    ];
    for (const skill of skills) {
      doc.text(`  •  ${skill}`);
    }

    doc.end();
  } catch (err) {
    console.error('Failed to generate portfolio PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Could not generate PDF' });
    }
  }
});

export { router as portfolioRouter };
