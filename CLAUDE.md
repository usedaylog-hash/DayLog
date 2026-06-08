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
│       │   └── migrations/      # SQL migration files (001-009)
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

Six tables, managed by sequential SQL migrations (001–009):

- **sessions**: `id, clock_in, clock_out, summary, handoff, created_at`
- **notes**: `id, session_id (FK), content, timestamp, created_at`
- **commits**: `id, session_id (FK), hash, message, author, timestamp, comment, created_at` (UNIQUE on session_id+hash)
- **session_breaks**: `id, session_id (FK), pause_time, resume_time, reason, created_at`
- **invoices**: `id, invoice_number, invoice_date, period_start, period_end, hourly_rate, total_hours, total_amount, paid_date, paid_amount, created_at`
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

- **Single branch workflow** — all work happens on `master`. No feature branches or QA branch.
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
- Line items built from sessions: one row per session with clock-in/out times and condensed work descriptions (max 3 items, noise filtered)
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
- `PATCH /api/invoices/:id/paid` — Update payment amount (accepts `{ paid_amount }`, auto-derives `paid_date`)
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

## Invoice PDF Improvements (2026-05-29)

Three fixes to invoice PDF generation in `server/src/routes/invoices.ts`:

1. **Time rounding** — All clock-in/out times are rounded to the nearest 30 minutes via `roundToHalfHour()` (e.g. 7:57→8:00, 8:08→8:00, 4:16→4:30). Affects both displayed times and hours calculation.
2. **Condensed descriptions** — Work items filtered (removes "Update CLAUDE.md", "Update reports" noise), capped at 3 items per row with "+ N more" suffix when truncated.
3. **No orphaned columns** — Rows are pre-measured with `heightOfString()` before rendering; page breaks happen before the row starts so all columns stay together. Table headers reprint after each page break.

---

## Session Pause/Resume (2026-06-08) — Done

Pause the clock when stepping away from work (lunch, errands, appointments) so billable hours are accurate. Breaks show on invoices so the client can see exactly when work happened.

**How it works:**
- Click **Pause** → enter a reason → session clock stops
- Click **Resume** → clock restarts, break is logged with times and reason
- **Clock Out** auto-closes any active break
- Breaks are subtracted from duration everywhere: TodayPage status, DayCard history, summary/handoff, portfolio, invoices
- Delete individual breaks via `×` button on hover in break history

**Database:** `session_breaks` table (migration `009-session-breaks.sql`) — `id, session_id (FK), pause_time, resume_time, reason, created_at`. A session is "paused" when it has a break row with `resume_time IS NULL`.

**Endpoints:**
- `POST /api/sessions/pause` — accepts `{ reason }`, inserts break row
- `POST /api/sessions/resume` — sets `resume_time` on active break
- `DELETE /api/sessions/breaks/:id` — delete a break

**Invoice integration:** `getLineItems()` queries breaks per session, subtracts rounded break time from billable hours, and builds segmented descriptions showing work periods with break annotations:
```
8:00 AM - 12:00 PM
  [Break: 12:00 PM - 1:00 PM -- Lunch break]
1:00 PM - 3:30 PM
```

**Utility:** `totalBreakMs(breaks)` in `server/src/utils/invoice-utils.ts` — reused across invoice, summary, and portfolio calculations.

**Key files:**
- `server/src/routes/sessions.ts` — pause/resume/delete endpoints, breaks included in all session responses
- `server/src/utils/session-utils.ts` — `generateSummary()` and `generateHandoff()` accept breaks, subtract from duration
- `server/src/utils/invoice-utils.ts` — `totalBreakMs()` helper, `BreakInput` interface
- `server/src/routes/invoices.ts` — `getLineItems()` subtracts break time, shows segmented descriptions
- `server/src/routes/portfolio.ts` — batch-loads breaks, subtracts from session durations
- `client/src/pages/TodayPage.tsx` + `.module.css` — pause prompt, paused status, break history with delete
- `client/src/components/DayCard.tsx` — duration subtracts break time
- `client/src/types/index.ts` — `SessionBreak` interface, `breaks` field on `Session`
- `client/src/api/client.ts` — `pauseSession()`, `resumeSession()`, `deleteBreak()`

**Important:** When deploying new server code, the tsx watch process must be restarted to pick up route changes. The systemd service (`daylog.service`) needs `sudo systemctl restart daylog`. New SQL migration files don't trigger tsx watch restarts.

---

## LLC Formation & Business Setup (2026-06-03) — Done

Luke formed **LM Systems Consulting LLC** on June 3, 2026.

### What was completed:
- **LLC filed** with Washington Secretary of State (sos.wa.gov) — $180 filing fee
- **EIN obtained** from IRS (free, online)
- **UBI number obtained** from Washington State Department of Revenue (state business license)
- **LinkedIn profile created** — linkedin.com/in/luke-martinez-0b3a27413
  - Title: Software Developer at LM Systems Consulting LLC
  - Set to "Open to Work" for contract/freelance/remote
- **Resume created** — PDF with dark navy header, QR code linking to LinkedIn, and professional layout
  - Saved at `/home/luke/Documents/Luke_Martinez_Resume.pdf`
  - Generator script at `/home/luke/Documents/generate-resume.mjs` (uses pdfkit + qrcode)
  - QR code npm package installed at `/home/luke/Documents/node_modules/`
  - Markdown version at `/home/luke/Documents/Luke_Martinez_Resume.md`

### Business Details:
- **Business name:** LM Systems Consulting LLC
- **Owner:** Luke Martinez (sole member, single-member LLC)
- **Email:** lukemartinez.sm@gmail.com
- **Phone:** (509)-759-5948
- **Location:** Yakima, WA
- **Nature of business:** Software development and quality assurance consulting services
- **Client:** Floburn Inc. / Voxcar (current, $20/hr)

### SBDC Advisor — Assigned (2026-06-08)
- **Advisor:** Rick Bushman, Certified Business Advisor, Washington SBDC at WSU Everett
- **Phone:** (425) 248-4216 / (425) 948-0288
- **Office:** 915 N. Broadway, Suite 310, Everett, WA 98201
- **Zoom meeting scheduled:** Wednesday 6/10 at 10am
- **Topics to discuss:** Finding more clients, raising rates, operating agreement, business bank account

### Resources identified for business growth:
- **SCORE Yakima Valley** — Free business mentoring (yakimavalley.score.org)
- **SBDC at WSU Everett** — Rick Bushman assigned as advisor (see above)
- **Job platforms:** ReactJobs.io, Arc.dev, Indeed, Glassdoor, ZipRecruiter, Upwork, We Work Remotely
- **Networking:** Yakima Dev Meetup, Yakima Tech Connect, North Town Shared Space (32 N Front St)

### Still to do:
- Open a business bank account (bring EIN + LLC confirmation)
- Write a simple operating agreement (SBDC can help)
- Set up Upwork profile to find additional contract work
- Add profile photo to LinkedIn
- Add About/Summary section to LinkedIn
- Order business cards (design done — see printing section below)

---

## Business Card (2026-06-03) — Done

Designed and generated a business card for LM Systems Consulting LLC, inspired by Paul Allen's card from American Psycho.

### Design:
- **Style:** Minimalist, Paul Allen aesthetic — Garamond font, all caps, generous whitespace
- **Stock:** Colorplan Natural 540gsm (eggshell, same as the movie)
- **Ink:** All black, raised/thermographic printing
- **Layout:** QR code (LinkedIn) upper-left, company name + subtitle upper-right, name + title centered, contact info bottom-center
- **Size:** Standard 3.5" x 2" (252 x 144 pt)
- **Font:** EB Garamond (open-source Garamond from Google Fonts)

### Files:
- **PDF:** `/home/luke/Documents/LM_Systems_Business_Card.pdf`
- **Generator:** `/home/luke/Documents/generate-business-card.mjs` (uses pdfkit + qrcode)
- **Fonts:** `/home/luke/Documents/fonts/EBGaramond-Regular.ttf`, `EBGaramond-Italic.ttf`

### Printing:
- **Recommended vendor:** [After Hours Creative Studio](https://www.afterhourscreativestudio.com/colorplan-duplex-business-cards-540gsm.html) — Colorplan 540gsm business cards with foil/thermographic options (UK-based, ships internationally)
- **Alternative:** Buy Colorplan Natural 540gsm sheets from [Legion Paper](https://legionpaper.com/colorplan) or [TALAS](https://www.talasonline.com/Colorplan-Paper), take to a local print shop for thermographic printing
- **Specs to request:** Colorplan Natural 540gsm, black raised/thermographic ink, single-sided, 3.5" x 2"

---

## Freelance Platforms & Job Search (2026-06-05) — In Progress

### Profiles set up:
- **Upwork** — Profile complete, verified, $25/hr default rate. Skills: Software QA, Quality Assurance, React, TypeScript, Node.js, Playwright, Test Automation, Web Development, JavaScript, SQL, REST API, CSS
- **ZipRecruiter** — Profile updated with QA/software development objective (replaced old machining cover letter)
- **LinkedIn** — Active, applying to QA and developer roles
- **micro1.ai** — Applied to QA Engineer & Product Support Expert role; AI interview pending (deadline Jun 7, 2026)

### Applications submitted:
- Upwork: Contract Full-Stack Engineer (React + Supabase) — $45/hr proposal
- micro1: QA Engineer & Product Support Expert
- ZipRecruiter: QA Automation Tester — Technology Talent Network LLC (Newark, NJ)
- ZipRecruiter: QA / Test Engineer — fully remote, $34-42/hr, Playwright experience required

### Strategy:
- Focus on **manual QA testing roles** (no live coding required) for immediate income
- Search terms: "Manual QA tester", "QA analyst", "Bug testing", "Website testing", "UAT testing"
- Platforms to use: Upwork, LinkedIn, Indeed, ZipRecruiter
- Apply to 5-10 jobs per day across platforms

---

## Learning to Code (DAY-37 through DAY-40)

Tracked in Linear. Luke has been directing development but needs to learn to write code independently for coding interviews and career growth.

### Dependency Chain:
```
DAY-37  Learn TypeScript basics: variables, types, functions, if/else, loops (Week 1)
  └── DAY-38  Learn array/object methods: filter, map, sort, find, reduce (Week 2)
        └── DAY-39  Learn React basics: components, props, state, events (Week 3)
              └── DAY-40  Build a small DayLog feature independently (Week 4)
```

### Approach:
- Claude explains, Luke types the code
- Practice with real DayLog data structures and components
- Goal: pass live coding exercises in job interviews

### Progress:
- **DAY-37 started 2026-06-08** — Variables and types covered (const, let, string, number, boolean). Arrays and objects in progress. Practice file: `learning/basics.ts`. Progress log: `learning/LEARNING-LOG.md`

---

## Next Session Plan

**Primary focus:** Continue DAY-37 — TypeScript basics lesson. Variables and types are done. Resume with arrays, objects, functions, conditionals, and loops in `learning/basics.ts`. Luke needs to fix typos on lines 13 and 16 first, then move on to functions.

**Secondary:** SBDC Zoom call with Rick Bushman on Wednesday 6/10 at 10am. Continue applying to QA roles daily.

**DayLog done this session:** Session pause/resume feature (pause clock for breaks, subtract from billable hours, show on invoices). Break delete support added.

### Still to do (business):
- **SBDC Zoom call** — Wednesday 6/10 at 10am with Rick Bushman (finding clients, rates, operating agreement, bank account)
- Order printed business cards (quote requested from After Hours Creative — matte black foil embossing on Colorplan Natural 540gsm)
- Open a business bank account (bring EIN, LLC confirmation, and UBI number)
- Write a simple operating agreement (SBDC can help)
- Add profile photo to LinkedIn
- Add About/Summary section to LinkedIn
- Ask Jaime for a 2-3 sentence recommendation/testimonial
- Keep applying to QA roles daily across all platforms

### Future ideas:
- **Portfolio website** — Build a simple site to showcase completed projects, link QR code to it instead of LinkedIn
- **Multi-client support in DayLog** — Separate invoices, rates, and time tracking per client
- **Client management** — Client profiles with company info, contact details, contracts, payment terms
- **Business dashboard** — Revenue across clients, utilization rate, pipeline visibility
- **Branding** — Professional invoice templates with LLC branding, custom logo support

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
  - `invoice-utils.ts` — `getBiweeklyPeriods()`, `formatTime()`, `roundToHalfHour()`, period constants
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
2. **Payment Tracking** — Track partial and full payments on invoices (three states: Unpaid/Partial/Paid)
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
- **Migration** (`006-invoice-paid-amount.sql`): Adds `paid_amount REAL DEFAULT 0` to `invoices` table, backfills existing paid invoices with `total_amount`.
- **Settings section** at the bottom of InvoicesPage — two-column grid (contractor left, client right), with hourly rate (`$` prefix) and tax rate (`%` suffix). Save button calls `updateInvoiceConfig()`.
- **Payment status** adds a Status column to Past Invoices table with three states:
  - **Unpaid** (amber badge) — click opens inline amount input pre-filled with full amount
  - **Partial** (blue badge) — shows `$paid/$total (remaining)`, click opens input pre-filled with full amount
  - **Paid** (green badge) — shows paid date, click prompts confirm-to-unpaid (resets to 0)
- **Payment logic**: PATCH endpoint accepts `{ paid_amount }`. `paid_date` is auto-derived: set to today when `paid_amount >= total_amount`, null otherwise.
- **Tax overview** section between Past Invoices and Settings. Year dropdown (current + previous year), 3-card stats grid (YTD Earned, YTD Est. Tax, Outstanding), quarter-by-quarter table. Tax summary uses actual `paid_amount` for paid/unpaid breakdown. Tax rate configurable via settings (default 30% covers ~15.3% SE + ~15% federal).
- **New endpoints:** `PATCH /api/invoices/:id/paid`, `GET /api/invoices/tax-summary?year=`
- **New types:** `TaxSummary`, `QuarterData` in `client/src/types/index.ts`
- **New API methods:** `updatePayment()`, `getTaxSummary()` in `client/src/api/client.ts`

---

## Linear MCP Server

Added Linear MCP server to Claude Code config (local scope):
```
claude mcp add --transport http linear-server https://mcp.linear.app/mcp
```
Config stored in `/home/luke/.claude.json` — needs OAuth authentication on next session start (will prompt in browser).
