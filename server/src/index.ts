import './env.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { sessionsRouter } from './routes/sessions.js';
import { notesRouter } from './routes/notes.js';
import { testRunsRouter } from './routes/test-runs.js';
import { commitsRouter } from './routes/commits.js';
import { portfolioRouter } from './routes/portfolio.js';
import { invoicesRouter } from './routes/invoices.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

// Run database migrations on startup
runMigrations();

// Health check
app.get('/api/health', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: 'error', uptime: process.uptime() });
  }
});

// Serve archived test attachments (screenshots, videos)
app.use('/api/attachments', express.static(
  path.resolve(__dirname, '../../../BlackBox/reports/attachments'),
  { maxAge: '1h', fallthrough: false }
));

// API routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/notes', notesRouter);
app.use('/api/test-runs', testRunsRouter);
app.use('/api', commitsRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/invoices', invoicesRouter);

// Production: serve client static files and SPA fallback
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`DayLog server running on http://localhost:${PORT}`);
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Force exit after 5 seconds if connections don't close
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
