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
│       ├── pages/               # TodayPage, HistoryPage, TestRunsPage, TestRunDetailPage, PortfolioPage
│       ├── types/index.ts       # Shared TypeScript interfaces
│       ├── App.tsx              # Router setup
│       ├── index.css            # Global CSS variables and base styles
│       └── main.tsx             # Entry point
├── server/
│   └── src/
│       ├── db/
│       │   ├── connection.ts    # SQLite setup
│       │   ├── migrate.ts       # Migration runner (auto-applies on startup)
│       │   └── migrations/      # SQL migration files (001-003)
│       ├── routes/              # sessions, notes, commits, test-runs, portfolio
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

Three tables, managed by sequential SQL migrations:

- **sessions**: `id, clock_in, clock_out, summary, handoff, created_at`
- **notes**: `id, session_id (FK), content, timestamp, created_at`
- **commits**: `id, session_id (FK), hash, message, author, timestamp, comment, created_at` (UNIQUE on session_id+hash)

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

### Outstanding fixes (not yet applied — session interrupted)

These were reviewed and approved but the write was interrupted before commit:

1. **Extract shared `getPortfolioData()` function** — the `/` and `/pdf` handlers duplicate all the data-gathering logic. Extract into one shared function.
2. **Fix N+1 queries** — per-session `SELECT COUNT(*)` calls should be a single `GROUP BY session_id` query for commits and notes.
3. **Move activity extraction server-side** — both server PDF and client parse `summary.split('\n')` to get activity. Add an `activity` field to the API response, remove client-side parsing.
4. **Default FINDING severity to "Info"** instead of "Medium" — findings without `**Severity:**` are UX observations, not functional bugs.
5. **Sort bugs by date descending** — most recent work first (currently ascending by filename).
6. **Remove 30-session cap in PDF** — let pdfkit handle page breaks for all sessions instead of silently dropping the rest.
7. **Clean up minor issues** — unused `rowY` variable, add page-break checks in bugs section, add mobile table scroll wrapper.

### Linear MCP server

Added Linear MCP server to Claude Code config (local scope):
```
claude mcp add --transport http linear-server https://mcp.linear.app/mcp
```
Config stored in `/home/luke/.claude.json` — needs OAuth authentication on next session start (will prompt in browser).
