import express from 'express';
import cors from 'cors';
import { runMigrations } from './db/migrate.js';
import { sessionsRouter } from './routes/sessions.js';
import { notesRouter } from './routes/notes.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Run database migrations on startup
runMigrations();

// API routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/notes', notesRouter);

app.listen(PORT, () => {
  console.log(`DayLog server running on http://localhost:${PORT}`);
});
