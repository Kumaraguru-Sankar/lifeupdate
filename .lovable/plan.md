
# Finance OS Upgrade

Transform `/finance` from a basic dashboard into a complete personal finance module while keeping the current Neo Brutalist design language and the rest of LifeUpdate untouched.

## 1. Data model (single migration)

New tables (all RLS-scoped to `auth.uid()`, GRANTs to `authenticated` + `service_role`):

- `accounts` — id, user_id, name, type (`cash|bank|credit_card|wallet|investment|loan`), balance, currency, color, icon, archived, timestamps
- `finance_categories` — id, user_id, name, kind (`income|expense`), icon, color, sort_order, is_default
- `transactions` — id, user_id, type (`income|expense|transfer|investment`), amount, account_id, to_account_id (transfers), category_id, note, occurred_on, recurring (bool), recurrence_rule (text), timestamps
- `budgets` — id, user_id, category_id, month (date, 1st of month), amount
- `liabilities` — id, user_id, name, type (`loan|credit_card|other`), balance, interest_rate, due_day
- `finance_goals_link` — extend existing `goals` with optional `target_amount`, `current_amount`, `kind` (`finance|other`) via ALTER

Migration also:
- Adds `is_recurring`, `category_id` to existing `expenses`/`incomes` for back-compat (read both old + new in UI), or we leave legacy tables read-only and write only to `transactions`. We'll **write to `transactions`** going forward; old `expenses`/`incomes`/`subscriptions`/`investments` continue to be read so existing data stays visible.
- Seeds default categories on first load via a `seed_finance_defaults(user_id)` SQL function called from the app on empty state.

## 2. Route structure

Keep `/finance` as the hub with internal tabs (mobile-friendly chips, no new top-level routes):

```
/finance
  ├─ Overview     (default — dashboard)
  ├─ Transactions
  ├─ Budgets
  ├─ Subscriptions
  ├─ Investments
  ├─ Net Worth
  ├─ Goals
  ├─ Calendar
  └─ Insights
```

Implemented as a single route file with a `view` search param (`?view=transactions`) so deep links work and the bottom nav stays untouched.

## 3. Components (Neo Brutalist, reuse existing tokens)

New under `src/components/finance/`:
- `FinanceTabs.tsx` — chunky chip tabs
- `StatCard.tsx` — value + delta vs prev month + arrow
- `TransactionList.tsx` + `TransactionRow.tsx` + `TransactionSheet.tsx` (add/edit/duplicate/delete)
- `CategoryPicker.tsx`, `AccountPicker.tsx`
- `BudgetBar.tsx` — progress with warning at 80%, over at 100%
- `SubscriptionCard.tsx` + monthly total banner
- `InvestmentCard.tsx` + `AllocationDonut.tsx`
- `NetWorthCard.tsx` + `NetWorthSparkline.tsx`
- `FinanceCalendar.tsx` — month grid with dots for bills/subs/SIPs/salary
- `InsightsList.tsx` — rule-based + optional AI call
- `FinanceFAB.tsx` — quick-add menu (Expense / Income / Investment / Subscription), shown only on `/finance`

## 4. Quick-add FAB

Floating button inside Finance only (not global). Opens a radial/sheet menu with 4 actions, each opening the corresponding sheet pre-filled.

## 5. AI Insights

Reuse Lovable AI Gateway via a new `createServerFn` `getFinanceInsights` that:
- Fetches last 60 days of transactions for the user (server-side, RLS-scoped)
- Computes basic aggregates server-side, then asks `google/gemini-2.5-flash` to produce 3–5 short insight strings
- Cached for 6h via query key including month

Falls back to deterministic rule-based insights if AI fails (spend vs last month, subscription total, savings rate, goal ETA).

## 6. Home screen integration

Update `/_authenticated/index.tsx` Finance Snapshot card to show: Net Worth, Monthly Spending, Monthly Income, Savings Rate (derived from transactions + accounts). Order remains Health → Finance → Goals → Habits → Notes (already correct; just enrich the Finance card).

## 7. Empty states

Every tab gets a Neo Brutalist empty card with "Start building your financial future." + Add Income / Add Expense CTAs that open the FAB sheets. No blank screens, ever (wrapped in route `errorComponent` + per-section try/catch as already exists).

## 8. Out of scope (call out)

- Bank sync / Plaid-style aggregation (no provider configured)
- Multi-currency conversion (single currency stored per account; display uses profile locale)
- Real receipt OCR
- Push notifications for reminders (calendar shows them; no native push)

## Technical notes

- All money stored as `numeric(14,2)`; UI formats with `Intl.NumberFormat` using the user's locale (default `en-IN`, `INR`).
- Charts: lightweight inline SVG (matches existing `habit-analytics`) — no new chart lib.
- Sheets use existing shadcn `Sheet` / `Dialog` already in the project.
- All mutations use `useMutation` + `safeErrorMessage` per existing security memory.
- Migration is one approval; everything else lands after types regenerate.

## Build order

1. Migration (schema + seed function + GRANTs + RLS).
2. Shared finance components + tabs scaffold.
3. Transactions (core — everything else reads from it).
4. Budgets → Subscriptions → Investments → Net Worth → Calendar.
5. Goals link + Insights (AI server fn).
6. FAB + Home snapshot enrichment.
7. Verify build, empty states, and that legacy `expenses`/`incomes` rows still display.
