import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './db/migrate.js';
import { sessionsRouter } from './routes/sessions.js';
import { notesRouter } from './routes/notes.js';
import { testRunsRouter } from './routes/test-runs.js';
import { commitsRouter } from './routes/commits.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Run database migrations on startup
runMigrations();

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

app.listen(PORT, () => {
  console.log(`DayLog server running on http://localhost:${PORT}`);
});
