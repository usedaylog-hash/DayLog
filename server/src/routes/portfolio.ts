import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { db } from '../db/connection.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLACKBOX_DIR = path.resolve(__dirname, '../../../../BlackBox');
const BUGS_DIR = path.join(BLACKBOX_DIR, 'bugs');
const REPORTS_DIR = path.join(BLACKBOX_DIR, 'reports');

interface BugReport {
  filename: string;
  title: string;
  date: string;
  severity: string;
  summary: string;
  featureArea: string;
  environment: string;
  reporter: string;
}

interface PortfolioSession {
  id: number;
  date: string;
  duration: string;
  commitCount: number;
  noteCount: number;
  summary: string | null;
}

interface TestRunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  runCount: number;
}

function parseBugFile(filepath: string, filename: string): BugReport | null {
  try {
    const content = fs.readFileSync(filepath, 'utf-8');

    // Extract title from first heading
    const titleMatch = content.match(/^#+ (?:Bug Report:\s*)?(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : filename;

    // Extract date
    const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)/);
    const date = dateMatch ? dateMatch[1].trim() : '';

    // Extract severity
    const severityMatch = content.match(/\*\*Severity:\*\*\s*(.+)/i);
    const severity = severityMatch ? severityMatch[1].trim() : 'Medium';

    // Extract summary from Summary section
    const summaryMatch = content.match(/###?\s*Summary\s*\n\n(.+?)(?:\n\n|$)/s);
    const summary = summaryMatch ? summaryMatch[1].trim().split('\n')[0] : '';

    // Extract environment
    const envMatch = content.match(/\*\*Environment:\*\*\s*(.+)/);
    const environment = envMatch ? envMatch[1].trim() : '';

    // Extract reporter
    const reporterMatch = content.match(/\*\*Reporter:\*\*\s*(.+)/);
    const reporter = reporterMatch ? reporterMatch[1].trim() : 'Luke';

    // Derive feature area from filename
    // e.g. BUG-2026-02-11-edit-fuel-record-api-error.md -> "Fuel Record"
    // FINDING-2026-04-21-settings-silent-validation.md -> "Settings"
    const slugMatch = filename.match(/^(?:BUG|FINDING)-\d{4}-\d{2}-\d{2}-(.+)\.md$/);
    let featureArea = 'General';
    if (slugMatch) {
      const slug = slugMatch[1];
      // Map common slug patterns to feature areas
      const areaMap: [RegExp, string][] = [
        [/^edit-fuel/, 'Fuel Records'],
        [/^fuel/, 'Fuel Records'],
        [/^ai-usage/, 'AI Usage Analytics'],
        [/^ai-analysis/, 'AI Analysis'],
        [/^admin/, 'Admin Panel'],
        [/^non-admin/, 'Admin Panel'],
        [/^double-api/, 'Analytics'],
        [/^singular-mileage/, 'Mileage'],
        [/^parts/, 'Parts'],
        [/^settings/, 'Settings'],
        [/^ownership/, 'Ownership'],
        [/^carbuddy/, 'CarBuddy AI'],
      ];
      for (const [pattern, area] of areaMap) {
        if (pattern.test(slug)) {
          featureArea = area;
          break;
        }
      }
      if (featureArea === 'General') {
        // Fallback: capitalize first word of slug
        featureArea = slug.split('-')[0].charAt(0).toUpperCase() + slug.split('-')[0].slice(1);
      }
    }

    return { filename, title, date, severity, summary, featureArea, environment, reporter };
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

function formatDuration(clockIn: string, clockOut: string): string {
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatDurationMs(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// GET /api/portfolio
router.get('/', (_req, res) => {
  try {
    // Sessions and commits from DB
    const sessions = db.prepare(
      'SELECT * FROM sessions WHERE clock_out IS NOT NULL ORDER BY clock_in DESC'
    ).all() as Array<{ id: number; clock_in: string; clock_out: string; summary: string | null }>;

    const totalCommits = (db.prepare(
      'SELECT COUNT(*) as count FROM commits'
    ).get() as { count: number }).count;

    let totalMs = 0;
    const portfolioSessions: PortfolioSession[] = sessions.map((s) => {
      const ms = new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime();
      totalMs += ms;

      const commitCount = (db.prepare(
        'SELECT COUNT(*) as count FROM commits WHERE session_id = ?'
      ).get(s.id) as { count: number }).count;

      const noteCount = (db.prepare(
        'SELECT COUNT(*) as count FROM notes WHERE session_id = ?'
      ).get(s.id) as { count: number }).count;

      return {
        id: s.id,
        date: s.clock_in,
        duration: formatDuration(s.clock_in, s.clock_out),
        commitCount,
        noteCount,
        summary: s.summary,
      };
    });

    // Parse bug reports
    const bugs: BugReport[] = [];
    try {
      const bugFiles = fs.readdirSync(BUGS_DIR)
        .filter((f) => (f.startsWith('BUG-') || f.startsWith('FINDING-')) && f.endsWith('.md'))
        .sort();

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

    res.json({
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
    });
  } catch (err) {
    console.error('Failed to build portfolio data:', err);
    res.status(500).json({ error: 'Could not load portfolio data' });
  }
});

// GET /api/portfolio/pdf
router.get('/pdf', (_req, res) => {
  try {
    // Gather data (same as above)
    const sessions = db.prepare(
      'SELECT * FROM sessions WHERE clock_out IS NOT NULL ORDER BY clock_in DESC'
    ).all() as Array<{ id: number; clock_in: string; clock_out: string; summary: string | null }>;

    const totalCommits = (db.prepare(
      'SELECT COUNT(*) as count FROM commits'
    ).get() as { count: number }).count;

    let totalMs = 0;
    for (const s of sessions) {
      totalMs += new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime();
    }

    const bugs: BugReport[] = [];
    try {
      const bugFiles = fs.readdirSync(BUGS_DIR)
        .filter((f) => (f.startsWith('BUG-') || f.startsWith('FINDING-')) && f.endsWith('.md'))
        .sort();
      for (const file of bugFiles) {
        const bug = parseBugFile(path.join(BUGS_DIR, file), file);
        if (bug) bugs.push(bug);
      }
    } catch {
      // ignore
    }

    const testStats = getTestRunStats();
    const passRate = testStats.total > 0
      ? Math.round((testStats.passed / testStats.total) * 100)
      : 0;

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
      `Total Time Logged: ${formatDurationMs(totalMs)}`,
      `Work Sessions: ${sessions.length}`,
      `Commits: ${totalCommits}`,
      `Bugs Reported: ${bugs.length}`,
      `Test Runs: ${testStats.runCount}`,
      `Overall Pass Rate: ${passRate}%`,
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

    // Session history
    if (sessions.length > 0) {
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
      for (const s of sessions.slice(0, 30)) { // Limit to 30 for PDF length
        const commitCount = (db.prepare(
          'SELECT COUNT(*) as count FROM commits WHERE session_id = ?'
        ).get(s.id) as { count: number }).count;

        const dateStr = new Date(s.clock_in).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        });
        const duration = formatDuration(s.clock_in, s.clock_out);

        // Get first line of summary for activity
        const activity = s.summary
          ? s.summary.split('\n').filter((l: string) => l.trim() && !l.startsWith('Session:'))[0] || ''
          : '';

        const rowY = doc.y;

        // Check if we need a new page
        if (rowY > 750) {
          doc.addPage();
        }

        doc.text(dateStr, col1, doc.y, { width: 110 });
        const lineY = doc.y - doc.currentLineHeight();
        doc.text(duration, col2, lineY, { width: 60 });
        doc.text(String(commitCount), col3, lineY, { width: 60 });
        doc.text(activity.slice(0, 50), col4, lineY, { width: 235 });
        doc.moveDown(0.2);
      }
      doc.moveDown(1);
    }

    // Skills section
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
