# CLAUDE.md — DayLog

This file provides guidance to Claude Code when working in the DayLog repository.

---

## Project Overview

DayLog is a full-stack daily work journal and time-tracking tool. Clock in, log your work, clock out, and get a clean summary of what you accomplished. It also auto-tracks git commits from BlackBox and displays QA regression test results.

**Tech Stack:**
- **Client:** React 19, React Router 7, TypeScript, Vite, CSS Modules
- **Server:** Express 5, better-sqlite3, TypeScript, tsx
- **Database:** SQLite (WAL mode) at `data/daylog.db` (configurable via `DATABASE_PATH` env var)
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
- `PATCH /api/invoices/:id/paid` — Mark invoice paid/unpaid
- `GET /api/invoices/tax-summary?year=` — Quarterly tax breakdown

**Config:** Billed to Floburn Inc., hourly rate $20/hr. Config seeded with defaults in migration.

**Toast component:** Made `onUndo` optional in `Toast.tsx` so it can be reused as a simple confirmation toast (used for invoice deletion).

---

## Production Server

### Environment Variables

Configured via `.env` file in project root (see `.env.example`) or via systemd `EnvironmentFile`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server listen port |
| `DATABASE_PATH` | `data/daylog.db` | SQLite database path (relative to project root) |
| `NODE_ENV` | — | Set to `production` to serve client static files |

The `.env` loader (`server/src/env.ts`) is a zero-dependency side-effect module imported first in `index.ts`. Environment variables already set take precedence over `.env` values.

### Health Check

`GET /api/health` — pings the database, returns `{ status: "ok", uptime: <seconds> }` or `503` if DB is unreachable.

### Production Mode

When `NODE_ENV=production`, the server serves `client/dist/` as static files with SPA fallback. Build first with `npm run build`.

```bash
npm run build
NODE_ENV=production npm start
# Server on :3001 serves both API and client
```

### Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` — closes HTTP connections, closes the SQLite database, then exits.

### systemd Service

`daylog.service` in the repo root. Install with:

```bash
sudo cp daylog.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable daylog
sudo systemctl start daylog
```

Logs via `journalctl -u daylog -f`.

---

## Smoke Test

Standalone Playwright script for read-only visual verification of all pages.

```bash
npx playwright install chromium   # one-time setup
npm run dev                        # in another terminal
node smoke-test.mjs                # navigates all pages, saves screenshots
```

Screenshots saved to a temp directory (path printed on run). Does not modify any data.

---

## Next Session Plan

All planned features (DAY-20 through DAY-26) are complete. No pending work items.

---

## CI/CD Pipeline

Jenkins-based CI/CD for DayLog. Tracked as DAY-27 through DAY-30.

### Linear Issues & Dependency Chain

```
DAY-27  Set up Jenkins server for DayLog CI/CD (High) ✅
  ├── DAY-28  Add linting and type checking to the pipeline (Medium) ✅
  └── DAY-29  Add test framework (Vitest) and write initial test suite (Medium) ✅
        └── DAY-30  Set up automated deployment pipeline (Low) ✗ Canceled
```

### Jenkins Setup (DAY-27) — Done

**Jenkinsfile** at repo root — declarative pipeline with 5 stages:
1. **Install** — `npm ci` in root, `client/`, and `server/`
2. **Build** — `npm run build` (tsc + vite)
3. **Lint** — ESLint for client + server
4. **Typecheck** — `tsc --noEmit` for client + server
5. **Test** — Vitest for client + server with JUnit XML output (DAY-29)
6. **Deploy** — Removed (DAY-30 canceled)

Post block cleans workspace on every run. No `tools` block needed — Node.js is system-installed.

**Jenkins server setup:**
- Jenkins 2.555.2 installed via apt, running on `http://localhost:8080`
- Requires Java 21+ (openjdk-21-jre) — Java 17 is too old for this version
- Jenkins user added to `luke` group for repo access (`sudo usermod -aG luke jenkins`)
- Safe directory configured: `sudo -u jenkins git config --global --add safe.directory /home/luke/MyCode/src/DayLog` (and `.git`)
- Local checkout enabled via systemd override: `sudo systemctl edit jenkins` → `Environment="JAVA_OPTS=-Dhudson.plugins.git.GitSCM.ALLOW_LOCAL_CHECKOUT=true"`
- Pipeline job "Daylog" configured as "Pipeline script from SCM" pointing to `/home/luke/MyCode/src/DayLog`, branch `*/master`
- Manual trigger only (no polling/webhooks)

### Linting & Type Checking (DAY-28) — Done

**ESLint 9** (flat config) for both client and server:
- `client/eslint.config.js` — `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-plugin-react-hooks`
- `server/eslint.config.js` — `@eslint/js` recommended + `typescript-eslint` recommended
- Scripts: `npm run lint` and `npm run typecheck` in client, server, and root `package.json`
- Jenkins Lint stage runs both linters; Typecheck stage runs `tsc --noEmit` for both

### Testing (DAY-29) — Done

**Vitest** for both client and server:
- `server/vitest.config.ts` + `client/vitest.config.ts` — globals enabled, JUnit XML reporter when `CI=true`
- Scripts: `npm test` (vitest run) and `npm test:watch` (vitest) in client, server, and root
- Pure business logic extracted to `server/src/utils/` for testability:
  - `invoice-utils.ts` — `getBiweeklyPeriods()`, `formatTime()`, period constants
  - `session-utils.ts` — `generateSummary()`, `generateHandoff()`
  - `portfolio-utils.ts` — `formatDuration()`, `formatDurationMs()`, `extractActivity()`, `parseBugContent()`
- Route files updated to import from utils (no behavior changes)
- Test files: `server/src/utils/*.test.ts` (~40 tests) + `client/src/api/client.test.ts` (~20 tests)
- Jenkins Test stage runs `CI=true npm test` in both dirs; JUnit results collected via `junit` post step

CI/CD pipeline is complete (DAY-27 through DAY-29). Deployment (DAY-30) was canceled — no auto-deploy needed.

---

## Invoice Settings, Payment Tracking & Tax Estimates (DAY-20 through DAY-26) — Done

All tracked in Linear as DAY-20 through DAY-26.

**Three features added:**
1. **Config Settings UI** — Edit contractor/client info and rates directly in the Invoices tab
2. **Payment Tracking** — Mark invoices as paid/unpaid with date tracking
3. **Quarterly Tax Estimates** — Year-over-year quarterly earnings breakdown with estimated tax

### Linear Issues & Dependency Chain

```
DAY-20  Migration: paid_date column + tax_rate config seed (005-invoice-paid.sql) ✅
  ├── DAY-21  Server: PATCH /:id/paid endpoint (mark paid/unpaid) ✅
  └── DAY-22  Server: GET /tax-summary endpoint (quarterly breakdown) ✅
        └── DAY-23  Client: Types + API methods (Invoice.paid_date, TaxSummary, QuarterData) ✅
              ├── DAY-24  UI: Invoice config settings section (two-column form grid) ✅
              ├── DAY-25  UI: Payment status column with paid/unpaid badge toggle ✅
              └── DAY-26  UI: Tax overview section with quarterly breakdown + stats grid ✅
```

### Implementation Details

- **Migration** (`005-invoice-paid.sql`): Adds `paid_date TEXT` to `invoices` table and seeds `tax_rate = '30'` in `invoice_config`. The migration runner in `migrate.ts` catches "duplicate column" errors for idempotency.
- **Settings section** at the bottom of InvoicesPage — two-column grid (contractor left, client right), with hourly rate (`$` prefix) and tax rate (`%` suffix). Save button calls `updateInvoiceConfig()`.
- **Payment status** adds a Status column to Past Invoices table. Unpaid = amber badge (click to mark paid with today's date), Paid = green badge with date (click to unmark with confirmation).
- **Tax overview** section between Past Invoices and Settings. Year dropdown (current + previous year), 3-card stats grid (YTD Earned, YTD Est. Tax, Outstanding), quarter-by-quarter table. Tax rate configurable via settings (default 30% covers ~15.3% SE + ~15% federal).
- **New endpoints:** `PATCH /api/invoices/:id/paid`, `GET /api/invoices/tax-summary?year=`
- **New types:** `TaxSummary`, `QuarterData` in `client/src/types/index.ts`
- **New API methods:** `markInvoicePaid()`, `markInvoiceUnpaid()`, `getTaxSummary()` in `client/src/api/client.ts`

---

## Linear MCP Server

Added Linear MCP server to Claude Code config (local scope):
```
claude mcp add --transport http linear-server https://mcp.linear.app/mcp
```
Config stored in `/home/luke/.claude.json` — needs OAuth authentication on next session start (will prompt in browser).
