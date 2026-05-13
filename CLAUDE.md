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
│       ├── pages/               # TodayPage, HistoryPage, TestRunsPage, TestRunDetailPage
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
│       ├── routes/              # sessions, notes, commits, test-runs
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
