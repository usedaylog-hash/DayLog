# CLAUDE.md — DayLog

This file provides guidance to Claude Code when working in the DayLog repository.

---

## Project Overview

DayLog is a full-stack daily work journal and time-tracking tool. Clock in, log your work, clock out, and get a clean summary of what you accomplished. It also auto-tracks git commits from BlackBox and displays QA regression test results.

**Tech Stack:**
- **Client:** React 19, React Router 7, TypeScript, Vite, CSS Modules
- **Server:** Express 5, better-sqlite3, TypeScript, tsx
- **Database:** SQLite (WAL mode) at `data/daylog.db`
- **No external UI libraries** — all styling is hand-rolled CSS Modules with variables in `index.css`

---

## Repository Structure

```
DayLog/
├── client/
│   └── src/
│       ├── api/client.ts        # Centralized fetch wrapper
│       ├── components/          # Reusable components (CSS Modules colocated)
│       ├── pages/               # TodayPage, HistoryPage, TestRunsPage, TestRunDetailPage, PortfolioPage, InvoicesPage
│       ├── types/index.ts       # Shared TypeScript interfaces
│       ├── App.tsx              # Router setup
│       ├── index.css            # Global CSS variables and base styles
│       └── main.tsx             # Entry point
├── server/
│   └── src/
│       ├── db/
│       │   ├── connection.ts    # SQLite setup
│       │   ├── migrate.ts       # Migration runner (auto-applies on startup)
│       │   └── migrations/      # SQL migration files (001-004)
│       ├── routes/              # sessions, notes, commits, test-runs, portfolio, invoices
│       └── index.ts             # Express app setup (port 3001)
└── data/daylog.db               # SQLite database
```

---

## Commands

```bash
npm run dev              # Run client + server concurrently
npm run dev:client       # Vite dev server only (localhost:5173)
npm run dev:server       # Express server only (localhost:3001, tsx watch)
npm run build            # Production build (tsc + vite build)
npm start                # Production server (tsx)
```

Client proxies API requests to localhost:3001 via Vite config.

---

## Database Schema

Five tables, managed by sequential SQL migrations:

- **sessions**: `id, clock_in, clock_out, summary, handoff, created_at`
- **notes**: `id, session_id (FK), content, timestamp, created_at`
- **commits**: `id, session_id (FK), hash, message, author, timestamp, comment, created_at` (UNIQUE on session_id+hash)
- **invoices**: `id, invoice_number, invoice_date, period_start, period_end, hourly_rate, total_hours, total_amount, created_at`
- **invoice_config**: `key, value` (key/value store for contractor/client info, hourly rate)

---

## Architecture Conventions

- **CSS variables** are defined in `client/src/index.css` under `:root`. All colors, radii, shadows, transitions, and layout tokens live there. Never hardcode colors in component CSS.
- **Global `.container` class** handles max-width and centering. Pages use `className="container"` on their wrapper div.
- **CSS Modules** for all component/page styling — files colocated as `ComponentName.module.css`.
- **No state management library** — React state + prop drilling. API layer is a plain fetch wrapper in `api/client.ts`.
- **Git commit tracking** works by running `git log` against the BlackBox repo during clock-out and polling.
- **Test run data** comes from parsing BlackBox's `reports/history.json` and individual report files.
- **Session handoff** writes a markdown file to `/home/luke/MyCode/src/BlackBox/LAST-SESSION.md` for continuity.

---

## Linear Project Tracking

- **Team:** DayLog App (key: DAY)
- **Project:** DayLog
- **Issue prefix:** DAY-N

### Project Phases

- **Phase 1 — Personal Daily Journal** ✅ Complete (DAY-5 through DAY-12)
  Clock in/out, timestamped notes, daily summaries, history view, session deletion, git commit tracking, test runs tab, UI polish.

- **Phase 2 — Automatic git and test run tracking** (upcoming)

- **Phase 3 — Linear integration for automatic project activity capture** (upcoming)

- **Phase 4 — Multi-user team features, shared dashboard, company branding** (upcoming)

---

## Key Decisions

- No new dependencies unless absolutely necessary — keep the stack lean.
- `prefers-reduced-motion` media query is in place — respect it when adding animations.
- Responsive breakpoints at 640px and 480px are already set up.

---

## Portfolio Feature (added 2026-05-28)

A "Portfolio" tab aggregates all QA work into a presentable view with PDF export.

**What it does:**
- Stats bar: total hours, sessions, commits, bugs found, test runs, pass rate
- Sessions table: date, duration, commits, notes, activity summary
- Bugs table: date, title, severity (color-coded badges), feature area, environment
- PDF download via pdfkit (server-side generation, streamed to client)

**Key files:**
- `server/src/routes/portfolio.ts` — `GET /api/portfolio` (JSON data) + `GET /api/portfolio/pdf` (PDF stream)
- `client/src/pages/PortfolioPage.tsx` + `.module.css`
- Bug data parsed from `/home/luke/MyCode/src/BlackBox/bugs/*.md` (handles both `BUG-` and `FINDING-` prefixes)

**Dependency added:** `pdfkit` + `@types/pdfkit` in `server/`

### Portfolio fixes — Done (2026-05-28)

| Linear | Description | Status |
|--------|-------------|--------|
| DAY-13 | Extract shared `getPortfolioData()` function | Done |
| DAY-14 | Fix N+1 queries with GROUP BY | Done |
| DAY-15 | Move activity extraction server-side | Done |
| DAY-16 | Default FINDING severity to "Info" | Done |
| DAY-17 | Sort bugs by date descending | Done |
| DAY-18 | Remove 30-session cap in PDF | Done |
| DAY-19 | Clean up minor issues | Done |

---

## Invoice Feature (added 2026-05-28)

An "Invoices" tab generates biweekly PDF invoices from DayLog session data.

**What it does:**
- Biweekly billing periods (Monday through Friday of the second week), anchored on 2026-01-05
- Line items built from sessions: one row per session with clock-in/out times and commit messages as work descriptions
- Configurable contractor/client info and hourly rate (stored in `invoice_config` table)
- Invoice numbering: `INV-YYYY-NNN`, auto-incremented per year
- PDF generation via pdfkit with dark navy header, contractor info, bill-to, rate section, services table, totals
- Preview before generating, delete with confirmation toast

**Key files:**
- `server/src/routes/invoices.ts` — All endpoints: list, config CRUD, periods, preview, generate PDF, re-download, delete
- `server/src/db/migrations/004-invoices.sql` — `invoices` + `invoice_config` tables
- `client/src/pages/InvoicesPage.tsx` + `.module.css`

**Endpoints:**
- `GET /api/invoices` — List all invoices
- `GET /api/invoices/periods` — Get last 6 biweekly periods
- `GET /api/invoices/config` — Get invoice config
- `PUT /api/invoices/config` — Update invoice config
- `GET /api/invoices/preview?periodStart=&periodEnd=` — Preview line items
- `POST /api/invoices/generate` — Generate PDF + save to DB
- `GET /api/invoices/:id/pdf` — Re-download past invoice
- `DELETE /api/invoices/:id` — Delete invoice

**Config:** Billed to Floburn Inc., hourly rate $20/hr. Config seeded with defaults in migration.

**Toast component:** Made `onUndo` optional in `Toast.tsx` so it can be reused as a simple confirmation toast (used for invoice deletion).

### Linear MCP server

Added Linear MCP server to Claude Code config (local scope):
```
claude mcp add --transport http linear-server https://mcp.linear.app/mcp
```
Config stored in `/home/luke/.claude.json` — needs OAuth authentication on next session start (will prompt in browser).
