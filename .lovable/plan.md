## Goal

Eliminate the "Something broke" error on `/finance`, render a graceful empty state when there is no data, reorder the Home screen, and lift the floating AI button to 32px above the bottom nav.

## 1. Diagnose the Finance crash

The Finance route (`src/routes/_authenticated.finance.tsx`) has no `errorComponent`, so any render-time exception inside its sub-components bubbles to the root `ErrorComponent` in `src/routes/__root.tsx` ("Something broke. Please try again.").

Likely render-time exceptions when data is empty or malformed:

- `Subscriptions`: `new Date(s.next_renewal).getTime()` returns `NaN` if `next_renewal` is missing.
- `Investments`: `i.asset_type.replace("_", " ")` throws if `asset_type` is null.
- `useFinance` query functions return raw `data` without unwrapping `error`; if a request fails, downstream `.reduce`/`.map` still receive `[]` (safe), but no UI feedback exists.
- All four `useQuery` calls run in parallel; if any throws during render, the entire page is replaced by the root error UI.

## 2. Finance module fix

In `src/routes/_authenticated.finance.tsx`:

- Add `errorComponent` and `pendingComponent` to `createFileRoute("/_authenticated/finance")` so a query error or render fault stays scoped to the page.
- Wrap each query consumer (`Overview`, `Spending`, `IncomeVsExpense`, `Expenses`, `Incomes`, `Subscriptions`, `Investments`) so missing fields never throw:
  - Guard `new Date(...)` with a valid-date check; show "—" if missing.
  - Default `i.asset_type ?? "other"` before `.replace`.
  - Coerce all numeric reads with `Number(x) || 0`.
- Compute a top-level `isEmpty = expensesQ.data?.length === 0 && incomesQ.data?.length === 0 && subsQ.data?.length === 0 && invQ.data?.length === 0` after all four queries resolve.
- When `isEmpty`, render a single Neo-Brutalist empty-state card instead of the dashboard:
  - Title: **"Start tracking your finances"**
  - Subtitle: *"Add your first income, expense, subscription or investment."*
  - Two buttons: `+ Add Income`, `+ Add Expense` that scroll to (and focus) the existing Income / Expense forms.
- Add a skeleton/loading state while any of the four queries are in `isPending`.
- Add a small inline retry banner (uses `refetch()`) above the dashboard if any query has `isError`.

## 3. Home screen reorder

In `src/routes/_authenticated.index.tsx`, reorder the JSX sections to:

1. Greeting (already first)
2. XP / Level hero (already #2)
3. Health snapshot
4. **Finance snapshot** (move up from current position #5)
5. Active goals
6. Daily habits
7. **Recent notes** (new): query `notes` table — `select id,title,updated_at` ordered by `updated_at` desc, limit 3; render with the existing `SectionTitle` linking to `/notes` and an `EmptyCard` fallback.

## 4. Floating AI button position

In `src/components/ai-fab.tsx`, change the inline `bottom` to sit 32px above the bottom nav. Bottom nav uses `bottom-3` (12px) + ~64px height, so:

```ts
style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 108px)" }}
```

(12px gap + 64px nav + 32px clearance).

## Files touched

- `src/routes/_authenticated.finance.tsx` — error/empty/loading states, defensive data handling, scoped errorComponent.
- `src/routes/_authenticated.index.tsx` — section reorder + Recent Notes block.
- `src/components/ai-fab.tsx` — bottom offset update.

No schema, no migrations, no backend changes.