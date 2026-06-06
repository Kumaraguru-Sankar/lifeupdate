# LifeUpdate → Offline-First Life Analytics Platform

A large multi-phase upgrade. I'll execute in this order so each phase is shippable on its own.

## Phase 1 — Strip all AI

- Delete `src/routes/_authenticated.assistant.tsx`, `src/lib/assistant.functions.ts`, `src/components/ai-fab.tsx`, `src/components/insights-panel.tsx` and any AI references in nav/home.
- Remove "Assistant" tab from the bottom nav in `app-shell.tsx`. Replace with **Reports**.
- Remove `ai_messages` reads/writes from the UI (keep table; harmless).
- Replace any "AI Insights" sections in Finance/Home with rule-based **Trends** / **Analytics** panels.

## Phase 2 — Offline-first (PWA + local cache)

- Add `vite-plugin-pwa` with `generateSW`, `autoUpdate`, `NetworkFirst` for HTML, `CacheFirst` for hashed assets, exclude `/~oauth`.
- Guarded registration wrapper per the PWA skill (no SW in dev/preview/iframe; `?sw=off` kill switch).
- Add `public/manifest.webmanifest` + icons + theme/apple meta tags.
- Persist React Query cache to **IndexedDB** via `@tanstack/query-persist-client` + `idb-keyval` so previously loaded data is readable offline.
- Add an **offline write queue** (`src/lib/offline-queue.ts`): every mutation goes through `enqueue(op)` which (a) optimistically updates the query cache and (b) tries the Supabase call; on failure stores the op in IndexedDB and retries when `navigator.onLine` flips true.
- Online/offline indicator chip in `AppShell`.

## Phase 3 — Global time-period filter

- New `src/lib/period.ts`: presets `today | 7d | 30d | 90d | 6m | 1y | all | custom{from,to}`; helpers `rangeFor(preset)`, `bucketize(range)`.
- New `src/components/period-picker.tsx`: chunky Neo Brutalist chip row + custom range popover (shadcn Calendar).
- New `src/hooks/use-period.ts`: stores selected period in `localStorage` per module key (`home`, `health`, `finance`, `goals`, `habits`).

## Phase 4 — Module analytics

Each module gets a **Period picker** at the top + an **Analytics** section. All charts are lightweight inline SVG (line, bar, pie, heatmap) under `src/components/charts/` — no chart lib.

- **Home (`index.tsx`)**: period picker drives Health/Finance/Goals/Habits snapshot numbers + sparkline.
- **Health**: trend lines for Steps/Water/Sleep/Calories/Workout; weight + BMI chart (BMI = weight / (height/100)^2 from profile); averages, best day, current streak.
- **Finance**: Replace the sliding tab chips with a **fixed grid of tabs** (all visible, no horizontal scroll) on the Finance page. Per-period Income / Expenses / Savings / Net Worth trend lines, category pie, subscription cost over time.
- **Goals**: completion history, success rate, abandoned count, productivity score (tasks done/day).
- **Habits**: GitHub-style heatmap (existing `habit-analytics` extended), per-habit completion %, streak history.
- **Notes/Journal**: New `_authenticated.journal.tsx` already-implied via `journal_entries`; group notes & journal by Year → Month → Day tree with search + tag filter. Add `tags text[]` column to notes (migration).

## Phase 5 — Reports

- New route `src/routes/_authenticated.reports.tsx` (bottom-nav slot vacated by Assistant).
- Tabs: Weekly / Monthly / Quarterly / Yearly / Custom. Each renders Health + Finance + Goals + Habits summary cards with trend deltas vs previous equivalent period.
- "Download as PDF" via browser `window.print()` with a print stylesheet.

## Migrations (single)

- `ALTER TABLE notes ADD COLUMN tags text[] NOT NULL DEFAULT '{}';`
- `ALTER TABLE notes ADD COLUMN category text;`
(No new tables.)

## Out of scope

- True multi-device CRDT sync (queue replays in order; last-write-wins is fine).
- Background sync via SW (queue flushes when the app regains focus + online).
- PDF generation library (print-to-PDF is sufficient).

## Build order

1. Phase 1 (strip AI) — small, shippable.
2. Phase 3 (period picker primitives) — needed by everything below.
3. Phase 4 module analytics (Home → Finance → Health → Habits → Goals → Notes/Journal).
4. Phase 5 Reports route.
5. Phase 2 PWA + offline queue + Query persistence + notes migration.

This is a multi-turn effort; after the plan is approved I'll start with Phase 1 + the period picker so the UI changes are visible immediately.
