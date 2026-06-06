import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safe-error";
import { cn } from "@/lib/utils";
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, Repeat, LineChart as LineIcon,
  Plus, Trash2, Calendar as CalIcon, Pencil, AlertTriangle, RefreshCcw,
  Search, X, ArrowUpRight, ArrowDownRight, Copy, ArrowLeftRight, Target as TargetIcon,
  Sparkles, Banknote, CreditCard, Receipt, Activity, ChevronLeft, ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/finance")({
  component: FinancePage,
  errorComponent: FinanceError,
  pendingComponent: FinanceLoading,
});

/* ---------- utils ---------- */
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = (d = new Date()) => { const x = new Date(d); x.setDate(1); return x.toISOString().slice(0, 10); };
const addMonths = (date: Date, n: number) => { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; };
const fmtMoney = (n: number) => {
  const safe = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(safe);
  } catch {
    return `₹${Math.round(safe).toLocaleString()}`;
  }
};
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const monthLabel = (d: Date) => d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

type Tab = "overview" | "transactions" | "budgets" | "subscriptions" | "investments" | "networth" | "goals" | "calendar" | "trends";

const TABS: { id: Tab; label: string; icon: any; tint: string }[] = [
  { id: "overview", label: "Overview", icon: Activity, tint: "var(--nb-yellow)" },
  { id: "transactions", label: "Tx", icon: Receipt, tint: "var(--nb-blue)" },
  { id: "budgets", label: "Budget", icon: TargetIcon, tint: "var(--nb-orange)" },
  { id: "subscriptions", label: "Subs", icon: Repeat, tint: "var(--nb-pink)" },
  { id: "investments", label: "Invest", icon: LineIcon, tint: "var(--nb-green)" },
  { id: "networth", label: "Worth", icon: Banknote, tint: "var(--nb-yellow)" },
  { id: "goals", label: "Goals", icon: PiggyBank, tint: "var(--nb-orange)" },
  { id: "calendar", label: "Cal", icon: CalIcon, tint: "var(--nb-blue)" },
  { id: "trends", label: "Trends", icon: TrendingUp, tint: "var(--nb-pink)" },
];

/* ---------- shared queries ---------- */
function useFinanceData() {
  const qc = useQueryClient();

  // Seed defaults on first load — fire and forget
  useEffect(() => {
    supabase.rpc("seed_finance_defaults" as any).then(() => {
      qc.invalidateQueries({ queryKey: ["finance_categories"] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts" as any).select("*").eq("archived", false).order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const categoriesQ = useQuery({
    queryKey: ["finance_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_categories" as any).select("*").order("kind").order("sort_order");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const transactionsQ = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions" as any).select("*").order("occurred_on", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const budgetsQ = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets" as any).select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const liabilitiesQ = useQuery({
    queryKey: ["liabilities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("liabilities" as any).select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const subsQ = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscriptions").select("*").order("next_renewal");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const invQ = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const goalsQ = useQuery({
    queryKey: ["goals_finance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  // Legacy reads — keep showing pre-existing data
  const legacyExpQ = useQuery({
    queryKey: ["legacy_expenses"],
    queryFn: async () => {
      const { data } = await supabase.from("expenses").select("*");
      return (data ?? []) as any[];
    },
  });
  const legacyIncQ = useQuery({
    queryKey: ["legacy_incomes"],
    queryFn: async () => {
      const { data } = await supabase.from("incomes").select("*");
      return (data ?? []) as any[];
    },
  });

  return { accountsQ, categoriesQ, transactionsQ, budgetsQ, liabilitiesQ, subsQ, invQ, goalsQ, legacyExpQ, legacyIncQ };
}

// Merge legacy + new into a uniform transaction list
function useAllTx() {
  const { transactionsQ, legacyExpQ, legacyIncQ, categoriesQ } = useFinanceData();
  const txs = useMemo(() => {
    const out: any[] = [];
    for (const t of transactionsQ.data ?? []) {
      out.push({
        id: t.id, _source: "tx", type: t.type, amount: num(t.amount),
        category_id: t.category_id, account_id: t.account_id, to_account_id: t.to_account_id,
        goal_id: t.goal_id, note: t.note, occurred_on: t.occurred_on, recurring: t.recurring,
      });
    }
    for (const e of legacyExpQ.data ?? []) {
      out.push({
        id: `legacy-exp-${e.id}`, _source: "legacy_exp", _legacyId: e.id,
        type: "expense", amount: num(e.amount),
        category_id: null, _legacyCategory: e.category,
        note: e.note, occurred_on: e.spent_on,
      });
    }
    for (const i of legacyIncQ.data ?? []) {
      out.push({
        id: `legacy-inc-${i.id}`, _source: "legacy_inc", _legacyId: i.id,
        type: "income", amount: num(i.amount),
        category_id: null, _legacyCategory: i.source,
        note: i.note, occurred_on: i.received_on,
      });
    }
    out.sort((a, b) => (b.occurred_on || "").localeCompare(a.occurred_on || ""));
    return out;
  }, [transactionsQ.data, legacyExpQ.data, legacyIncQ.data]);
  const catMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const c of categoriesQ.data ?? []) m[c.id] = c;
    return m;
  }, [categoriesQ.data]);
  return { txs, catMap };
}

/* ---------- root component ---------- */
function FinancePage() {
  const data = useFinanceData();
  const [tab, setTab] = useState<Tab>("overview");
  const [fabOpen, setFabOpen] = useState(false);
  const [sheet, setSheet] = useState<null | { type: "income" | "expense" | "transfer" | "investment" | "subscription"; id?: string; prefill?: any }>(null);

  const anyLoading = data.accountsQ.isPending || data.transactionsQ.isPending || data.categoriesQ.isPending;
  if (anyLoading) return <FinanceLoading />;

  const isEmpty =
    (data.transactionsQ.data?.length ?? 0) === 0 &&
    (data.legacyExpQ.data?.length ?? 0) === 0 &&
    (data.legacyIncQ.data?.length ?? 0) === 0 &&
    (data.subsQ.data?.length ?? 0) === 0 &&
    (data.invQ.data?.length ?? 0) === 0 &&
    (data.accountsQ.data?.length ?? 0) === 0;

  return (
    <AppShell title="Finance" subtitle="Money Operating System">
      <FinanceTabs tab={tab} onChange={setTab} />

      {isEmpty ? (
        <EmptyState onAdd={(t) => setSheet({ type: t })} />
      ) : (
        <div className="mt-5">
          {tab === "overview" && <OverviewTab data={data} onJump={setTab} />}
          {tab === "transactions" && <TransactionsTab onEdit={(tx) => setSheet({ type: tx.type, id: tx.id, prefill: tx })} onNew={(t) => setSheet({ type: t })} />}
          {tab === "budgets" && <BudgetsTab />}
          {tab === "subscriptions" && <SubscriptionsTab onEdit={(s) => setSheet({ type: "subscription", id: s.id, prefill: s })} onNew={() => setSheet({ type: "subscription" })} />}
          {tab === "investments" && <InvestmentsTab onEdit={(i) => setSheet({ type: "investment", id: i.id, prefill: i })} onNew={() => setSheet({ type: "investment" })} />}
          {tab === "networth" && <NetWorthTab />}
          {tab === "goals" && <GoalsFinanceTab />}
          {tab === "calendar" && <CalendarTab />}
          {tab === "trends" && <InsightsTab />}
        </div>
      )}

      {/* FAB */}
      <FinanceFab open={fabOpen} setOpen={setFabOpen} onPick={(t) => { setFabOpen(false); setSheet({ type: t }); }} />

      {/* Sheet */}
      {sheet && (
        <QuickSheet
          mode={sheet}
          onClose={() => setSheet(null)}
        />
      )}
    </AppShell>
  );
}

/* ---------- error / loading ---------- */
function FinanceError({ reset }: { error: Error; reset: () => void }) {
  return (
    <AppShell title="Finance" subtitle="Money Operating System">
      <div className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-8 text-center max-w-md mx-auto mt-6">
        <div className="grid place-items-center size-14 rounded-xl bg-[var(--nb-yellow)] border-[3px] border-[var(--nb-ink)] mx-auto mb-4">
          <AlertTriangle className="size-7" strokeWidth={2.6} />
        </div>
        <h2 className="font-display text-2xl mb-1">Finance is taking a breath</h2>
        <p className="text-sm text-muted-foreground mb-5">We couldn't load your finance data. Try again in a moment.</p>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-xl bg-[var(--nb-ink)] text-white px-5 py-2.5 text-sm font-bold border-[3px] border-[var(--nb-ink)] nb-shadow tap-scale">
          <RefreshCcw className="size-4" strokeWidth={3} /> Try again
        </button>
      </div>
    </AppShell>
  );
}
function FinanceLoading() {
  return (
    <AppShell title="Finance" subtitle="Money Operating System">
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-full bg-muted rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted" />)}
        </div>
        <div className="h-64 rounded-2xl bg-muted" />
      </div>
    </AppShell>
  );
}

/* ---------- tabs nav ---------- */
function FinanceTabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 pb-1">
      <div className="inline-flex gap-2 min-w-full">
        {TABS.map((t) => {
          const active = t.id === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border-[2.5px] border-[var(--nb-ink)] whitespace-nowrap transition-all",
                active ? "text-[var(--nb-ink)] nb-shadow" : "bg-card text-muted-foreground hover:text-foreground"
              )}
              style={active ? { background: t.tint } : undefined}
            >
              <Icon className="size-3.5" strokeWidth={3} />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- empty state ---------- */
function EmptyState({ onAdd }: { onAdd: (t: "income" | "expense") => void }) {
  return (
    <div className="rounded-3xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow-lg p-8 md:p-12 text-center max-w-xl mx-auto mt-6">
      <div className="grid place-items-center size-16 rounded-2xl bg-[var(--nb-green)] border-[3px] border-[var(--nb-ink)] mx-auto mb-5">
        <Wallet className="size-8" strokeWidth={2.6} />
      </div>
      <h2 className="font-display text-3xl md:text-4xl mb-2">Start building your financial future.</h2>
      <p className="text-muted-foreground mb-6">Track income, expenses, investments and goals — all in one place.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button onClick={() => onAdd("income")} className="inline-flex items-center gap-2 rounded-xl bg-[var(--nb-green)] text-[var(--nb-ink)] px-5 py-3 text-sm font-black border-[3px] border-[var(--nb-ink)] nb-shadow tap-scale">
          <Plus className="size-4" strokeWidth={3} /> Add Income
        </button>
        <button onClick={() => onAdd("expense")} className="inline-flex items-center gap-2 rounded-xl bg-[var(--nb-pink)] text-white px-5 py-3 text-sm font-black border-[3px] border-[var(--nb-ink)] nb-shadow tap-scale">
          <Plus className="size-4" strokeWidth={3} /> Add Expense
        </button>
      </div>
    </div>
  );
}

/* ---------- OVERVIEW ---------- */
function OverviewTab({ data, onJump }: { data: ReturnType<typeof useFinanceData>; onJump: (t: Tab) => void }) {
  const { txs } = useAllTx();
  const now = new Date();
  const thisMonth = firstOfMonth(now);
  const prevMonth = firstOfMonth(addMonths(now, -1));
  const nextMonth = firstOfMonth(addMonths(now, 1));

  const inRange = (t: any, from: string, to: string) => t.occurred_on >= from && t.occurred_on < to;

  const incomeThis = txs.filter(t => t.type === "income" && inRange(t, thisMonth, nextMonth)).reduce((s, t) => s + t.amount, 0);
  const expenseThis = txs.filter(t => t.type === "expense" && inRange(t, thisMonth, nextMonth)).reduce((s, t) => s + t.amount, 0);
  const incomePrev = txs.filter(t => t.type === "income" && inRange(t, prevMonth, thisMonth)).reduce((s, t) => s + t.amount, 0);
  const expensePrev = txs.filter(t => t.type === "expense" && inRange(t, prevMonth, thisMonth)).reduce((s, t) => s + t.amount, 0);

  const savingsThis = incomeThis - expenseThis;
  const savingsPrev = incomePrev - expensePrev;

  const accountsBalance = (data.accountsQ.data ?? []).reduce((s, a) => s + num(a.balance), 0);
  const invValue = (data.invQ.data ?? []).reduce((s, i) => s + num(i.current_value), 0);
  const invInvested = (data.invQ.data ?? []).reduce((s, i) => s + num(i.invested), 0);
  const liabilities = (data.liabilitiesQ.data ?? []).reduce((s, l) => s + num(l.balance), 0);
  const netWorth = accountsBalance + invValue - liabilities;

  const subs = data.subsQ.data ?? [];
  const monthlySubTotal = subs.reduce((s, x) => s + (x.cycle === "yearly" ? num(x.amount) / 12 : x.cycle === "weekly" ? num(x.amount) * 4.33 : num(x.amount)), 0);

  const savingsRate = incomeThis > 0 ? (savingsThis / incomeThis) * 100 : 0;
  const invDelta = invInvested > 0 ? ((invValue - invInvested) / invInvested) * 100 : 0;

  const delta = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / Math.abs(prev)) * 100;

  return (
    <div className="space-y-5">
      {/* Hero: Net worth */}
      <button onClick={() => onJump("networth")} className="block w-full text-left rounded-3xl bg-[var(--nb-ink)] text-white border-[3px] border-[var(--nb-ink)] nb-shadow-lg p-5 md:p-6 tap-scale">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--nb-yellow)] font-black">Net worth</span>
          <Banknote className="size-5 text-white/60" />
        </div>
        <div className="font-display text-5xl md:text-6xl leading-none">{fmtMoney(netWorth)}</div>
        <p className="text-white/70 text-sm mt-2 font-bold">Cash {fmtMoney(accountsBalance)} · Invest {fmtMoney(invValue)} · Liab {fmtMoney(liabilities)}</p>
      </button>

      {/* Month grid */}
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-black px-1">{monthLabel(now)}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Income" value={incomeThis} delta={delta(incomeThis, incomePrev)} tint="var(--nb-green)" icon={TrendingUp} />
        <StatCard label="Spending" value={expenseThis} delta={delta(expenseThis, expensePrev)} tint="var(--nb-pink)" icon={TrendingDown} invertDelta />
        <StatCard label="Savings" value={savingsThis} delta={delta(savingsThis, savingsPrev)} tint="var(--nb-blue)" icon={PiggyBank} sub={`${savingsRate.toFixed(0)}% rate`} />
        <StatCard label="Cash" value={accountsBalance} tint="var(--nb-yellow)" icon={Wallet} sub={`${data.accountsQ.data?.length ?? 0} accts`} />
        <StatCard label="Investments" value={invValue} delta={invDelta} tint="var(--nb-orange)" icon={LineIcon} />
        <StatCard label="Subscriptions" value={monthlySubTotal} tint="var(--nb-pink)" icon={Repeat} sub={`${subs.length} active`} />
        <StatCard label="Liabilities" value={liabilities} tint="var(--nb-orange)" icon={CreditCard} />
        <StatCard label="Net flow" value={savingsThis} tint={savingsThis >= 0 ? "var(--nb-green)" : "var(--nb-pink)"} icon={savingsThis >= 0 ? ArrowUpRight : ArrowDownRight} />
      </div>

      {/* Recent transactions */}
      <NbCard title="Recent activity" action={<button onClick={() => onJump("transactions")} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">View all</button>}>
        <RecentTxList limit={6} />
      </NbCard>

      {/* Spend by category */}
      <NbCard title="Spending by category">
        <SpendByCategory month={thisMonth} nextMonth={nextMonth} />
      </NbCard>
    </div>
  );
}

function StatCard({ label, value, delta, tint, icon: Icon, sub, invertDelta }: { label: string; value: number; delta?: number; tint: string; icon: any; sub?: string; invertDelta?: boolean }) {
  const showDelta = typeof delta === "number" && Number.isFinite(delta);
  const positive = showDelta ? (invertDelta ? delta! < 0 : delta! >= 0) : false;
  return (
    <div className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-3.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">{label}</span>
        <span className="grid place-items-center size-7 rounded-md border-[2px] border-[var(--nb-ink)]" style={{ background: tint }}>
          <Icon className="size-3.5" strokeWidth={3} />
        </span>
      </div>
      <div className="font-display text-2xl leading-tight truncate">{fmtMoney(value)}</div>
      <div className="flex items-center gap-2 mt-1">
        {showDelta && (
          <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border-[1.5px] border-[var(--nb-ink)]",
            positive ? "bg-[var(--nb-green)]/40" : "bg-[var(--nb-pink)]/40")}>
            {delta! >= 0 ? <ArrowUpRight className="size-2.5" strokeWidth={4} /> : <ArrowDownRight className="size-2.5" strokeWidth={4} />}
            {fmtPct(delta!)}
          </span>
        )}
        {sub && <span className="text-[10px] text-muted-foreground font-bold">{sub}</span>}
      </div>
    </div>
  );
}

function NbCard({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-4 md:p-5">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------- TRANSACTIONS ---------- */
function TransactionsTab({ onEdit, onNew }: { onEdit: (tx: any) => void; onNew: (t: "income" | "expense" | "transfer" | "investment") => void }) {
  const qc = useQueryClient();
  const { txs, catMap } = useAllTx();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "income" | "expense" | "transfer" | "investment">("all");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return txs.filter(t => {
      if (filter !== "all" && t.type !== filter) return false;
      if (!qq) return true;
      const cat = catMap[t.category_id]?.name ?? t._legacyCategory ?? "";
      return [t.note ?? "", cat, String(t.amount)].some(s => String(s).toLowerCase().includes(qq));
    });
  }, [txs, q, filter, catMap]);

  const del = useMutation({
    mutationFn: async (tx: any) => {
      if (tx._source === "tx") {
        const { error } = await supabase.from("transactions" as any).delete().eq("id", tx.id);
        if (error) throw error;
      } else if (tx._source === "legacy_exp") {
        const { error } = await supabase.from("expenses").delete().eq("id", tx._legacyId);
        if (error) throw error;
      } else if (tx._source === "legacy_inc") {
        const { error } = await supabase.from("incomes").delete().eq("id", tx._legacyId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["legacy_expenses"] });
      qc.invalidateQueries({ queryKey: ["legacy_incomes"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(safeErrorMessage(e, "Couldn't delete")),
  });

  const dup = useMutation({
    mutationFn: async (tx: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("");
      const { error } = await supabase.from("transactions" as any).insert({
        user_id: user.id,
        type: tx.type,
        amount: tx.amount,
        category_id: tx.category_id ?? null,
        account_id: tx.account_id ?? null,
        note: tx.note ?? null,
        occurred_on: today(),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); toast.success("Duplicated"); },
    onError: (e) => toast.error(safeErrorMessage(e, "Couldn't duplicate")),
  });

  return (
    <div className="space-y-4">
      {/* search + filters */}
      <div className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-3 flex flex-col gap-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, categories…" className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-muted border-[2px] border-[var(--nb-ink)] text-sm" />
          {q && <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 size-7 grid place-items-center text-muted-foreground"><X className="size-4" /></button>}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(["all", "income", "expense", "transfer", "investment"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={cn("px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border-[2px] border-[var(--nb-ink)]",
              filter === f ? "bg-[var(--nb-yellow)]" : "bg-card text-muted-foreground")}>{f}</button>
          ))}
        </div>
      </div>

      {/* quick add row */}
      <div className="grid grid-cols-4 gap-2">
        <QuickAddBtn label="Income" tint="var(--nb-green)" icon={TrendingUp} onClick={() => onNew("income")} />
        <QuickAddBtn label="Expense" tint="var(--nb-pink)" icon={TrendingDown} onClick={() => onNew("expense")} />
        <QuickAddBtn label="Transfer" tint="var(--nb-blue)" icon={ArrowLeftRight} onClick={() => onNew("transfer")} />
        <QuickAddBtn label="Invest" tint="var(--nb-orange)" icon={LineIcon} onClick={() => onNew("investment")} />
      </div>

      <NbCard>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No transactions match.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.slice(0, 100).map(tx => {
              const cat = catMap[tx.category_id];
              const catName = cat?.name ?? tx._legacyCategory ?? "Uncategorized";
              const isIncome = tx.type === "income";
              const tint = isIncome ? "var(--nb-green)" : tx.type === "expense" ? "var(--nb-pink)" : tx.type === "transfer" ? "var(--nb-blue)" : "var(--nb-orange)";
              return (
                <li key={tx.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid place-items-center size-9 rounded-lg border-[2.5px] border-[var(--nb-ink)] shrink-0" style={{ background: tint }}>
                      {isIncome ? <TrendingUp className="size-4" strokeWidth={3} /> : tx.type === "expense" ? <TrendingDown className="size-4" strokeWidth={3} /> : tx.type === "transfer" ? <ArrowLeftRight className="size-4" strokeWidth={3} /> : <LineIcon className="size-4" strokeWidth={3} />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{tx.note || catName}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold truncate">{catName} · {tx.occurred_on ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn("font-display text-base", isIncome ? "text-[color:var(--nb-green)]" : tx.type === "expense" ? "text-[color:var(--nb-pink)]" : "")}>
                      {isIncome ? "+" : tx.type === "expense" ? "−" : ""}{fmtMoney(tx.amount)}
                    </span>
                    {tx._source === "tx" && (
                      <>
                        <button onClick={() => dup.mutate(tx)} className="size-7 grid place-items-center text-muted-foreground hover:text-foreground" title="Duplicate"><Copy className="size-3.5" /></button>
                        <button onClick={() => onEdit(tx)} className="size-7 grid place-items-center text-muted-foreground hover:text-foreground" title="Edit"><Pencil className="size-3.5" /></button>
                      </>
                    )}
                    <button onClick={() => del.mutate(tx)} className="size-7 grid place-items-center text-muted-foreground hover:text-destructive" title="Delete"><Trash2 className="size-3.5" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </NbCard>
    </div>
  );
}

function QuickAddBtn({ label, tint, icon: Icon, onClick }: { label: string; tint: string; icon: any; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-xl border-[2.5px] border-[var(--nb-ink)] nb-shadow p-2.5 flex flex-col items-center gap-1 tap-scale" style={{ background: tint }}>
      <Icon className="size-4" strokeWidth={3} />
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function RecentTxList({ limit = 8 }: { limit?: number }) {
  const { txs, catMap } = useAllTx();
  if (txs.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>;
  return (
    <ul className="divide-y divide-border/60">
      {txs.slice(0, limit).map(tx => {
        const cat = catMap[tx.category_id];
        const catName = cat?.name ?? tx._legacyCategory ?? "Uncategorized";
        const isIncome = tx.type === "income";
        return (
          <li key={tx.id} className="flex items-center justify-between py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{tx.note || catName}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{catName} · {tx.occurred_on}</p>
            </div>
            <span className={cn("font-display text-base shrink-0", isIncome ? "text-[color:var(--nb-green)]" : "")}>{isIncome ? "+" : tx.type === "expense" ? "−" : ""}{fmtMoney(tx.amount)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function SpendByCategory({ month, nextMonth }: { month: string; nextMonth: string }) {
  const { txs, catMap } = useAllTx();
  const byCat: Record<string, number> = {};
  for (const t of txs) {
    if (t.type !== "expense") continue;
    if (!t.occurred_on || t.occurred_on < month || t.occurred_on >= nextMonth) continue;
    const key = catMap[t.category_id]?.name ?? t._legacyCategory ?? "Other";
    byCat[key] = (byCat[key] ?? 0) + t.amount;
  }
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground text-center py-6">Log expenses to see your spending mix.</p>;
  const palette = ["var(--nb-pink)", "var(--nb-orange)", "var(--nb-blue)", "var(--nb-green)", "var(--nb-yellow)", "var(--nb-ink)"];
  return (
    <div className="space-y-2.5">
      <div className="flex h-3 w-full rounded-full overflow-hidden border-[2px] border-[var(--nb-ink)]">
        {entries.map(([k, v], i) => <div key={k} style={{ width: `${(v / total) * 100}%`, background: palette[i % palette.length] }} />)}
      </div>
      <ul className="space-y-1.5">
        {entries.slice(0, 6).map(([k, v], i) => (
          <li key={k} className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 min-w-0">
              <span className="size-3 rounded-sm border-[1.5px] border-[var(--nb-ink)] shrink-0" style={{ background: palette[i % palette.length] }} />
              <span className="truncate">{k}</span>
            </span>
            <span className="font-bold tabular-nums shrink-0">{fmtMoney(v)} <span className="text-muted-foreground text-xs">{((v / total) * 100).toFixed(0)}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- BUDGETS ---------- */
function BudgetsTab() {
  const qc = useQueryClient();
  const { categoriesQ, budgetsQ } = useFinanceData();
  const { txs } = useAllTx();
  const now = new Date();
  const month = firstOfMonth(now);
  const next = firstOfMonth(addMonths(now, 1));

  const expenseCats = (categoriesQ.data ?? []).filter(c => c.kind === "expense");
  const budgetsByCat: Record<string, any> = {};
  for (const b of budgetsQ.data ?? []) {
    if (b.month?.startsWith(month.slice(0, 7))) budgetsByCat[b.category_id] = b;
  }
  const spentByCat: Record<string, number> = {};
  for (const t of txs) {
    if (t.type !== "expense" || !t.occurred_on || t.occurred_on < month || t.occurred_on >= next) continue;
    if (t.category_id) spentByCat[t.category_id] = (spentByCat[t.category_id] ?? 0) + t.amount;
  }

  const setBudget = useMutation({
    mutationFn: async ({ catId, amount }: { catId: string; amount: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("");
      const existing = budgetsByCat[catId];
      if (existing) {
        const { error } = await supabase.from("budgets" as any).update({ amount }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budgets" as any).insert({ user_id: user.id, category_id: catId, month, amount });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budgets"] }); toast.success("Budget saved"); },
    onError: (e) => toast.error(safeErrorMessage(e, "Couldn't save")),
  });

  const totalBudget = Object.values(budgetsByCat).reduce((s, b: any) => s + num(b.amount), 0);
  const totalSpent = Object.values(spentByCat).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-4">
      <NbCard title={monthLabel(now)}>
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Total budget</p>
            <p className="font-display text-3xl">{fmtMoney(totalSpent)} <span className="text-muted-foreground text-base">/ {fmtMoney(totalBudget)}</span></p>
          </div>
          <span className="text-xs font-bold">{totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}%` : "—"}</span>
        </div>
        <BudgetBar value={totalSpent} max={totalBudget} />
      </NbCard>

      <div className="space-y-2.5">
        {expenseCats.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Add categories to start budgeting.</p>}
        {expenseCats.map(c => {
          const b = budgetsByCat[c.id];
          const spent = spentByCat[c.id] ?? 0;
          const budget = num(b?.amount);
          return (
            <div key={c.id} className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-bold">{c.name}</p>
                <BudgetEditor current={budget} onSave={(amt) => setBudget.mutate({ catId: c.id, amount: amt })} />
              </div>
              <div className="flex items-baseline justify-between mb-1.5 text-sm">
                <span className="font-display text-lg">{fmtMoney(spent)}</span>
                <span className="text-muted-foreground text-xs">of {fmtMoney(budget)}</span>
              </div>
              <BudgetBar value={spent} max={budget} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BudgetBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(150, (value / max) * 100) : 0;
  const over = max > 0 && value > max;
  const warn = max > 0 && value > max * 0.8 && !over;
  const color = over ? "var(--nb-pink)" : warn ? "var(--nb-orange)" : "var(--nb-green)";
  return (
    <div className="h-3 w-full rounded-full bg-muted overflow-hidden border-[2px] border-[var(--nb-ink)]">
      <div className="h-full transition-[width] duration-700" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}

function BudgetEditor({ current, onSave }: { current: number; onSave: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(current || ""));
  if (!editing) return (
    <button onClick={() => { setVal(String(current || "")); setEditing(true); }} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
      <Pencil className="size-3" strokeWidth={3} /> Set
    </button>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); const n = Number(val); if (Number.isFinite(n) && n >= 0) { onSave(n); setEditing(false); } }} className="flex items-center gap-1">
      <input autoFocus type="number" value={val} onChange={(e) => setVal(e.target.value)} className="w-20 px-2 py-1 rounded border-[2px] border-[var(--nb-ink)] text-xs" />
      <button type="submit" className="text-[10px] font-black uppercase px-2 py-1 rounded bg-[var(--nb-yellow)] border-[2px] border-[var(--nb-ink)]">Ok</button>
      <button type="button" onClick={() => setEditing(false)} className="text-[10px] text-muted-foreground">x</button>
    </form>
  );
}

/* ---------- SUBSCRIPTIONS ---------- */
function SubscriptionsTab({ onEdit, onNew }: { onEdit: (s: any) => void; onNew: () => void }) {
  const qc = useQueryClient();
  const { subsQ } = useFinanceData();
  const subs = subsQ.data ?? [];
  const monthly = subs.reduce((s, x) => s + (x.cycle === "yearly" ? num(x.amount) / 12 : x.cycle === "weekly" ? num(x.amount) * 4.33 : num(x.amount)), 0);
  const yearly = monthly * 12;

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("subscriptions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscriptions"] }); toast.success("Removed"); },
    onError: (e) => toast.error(safeErrorMessage(e, "Couldn't delete")),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <NbCard><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Per month</p><p className="font-display text-3xl mt-1">{fmtMoney(monthly)}</p></NbCard>
        <NbCard><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Per year</p><p className="font-display text-3xl mt-1">{fmtMoney(yearly)}</p></NbCard>
      </div>
      <button onClick={onNew} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--nb-pink)] text-white px-4 py-3 text-sm font-black border-[3px] border-[var(--nb-ink)] nb-shadow tap-scale">
        <Plus className="size-4" strokeWidth={3} /> Add subscription
      </button>
      {subs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No subscriptions tracked yet.</p> : (
        <ul className="space-y-2.5">
          {subs.map(s => {
            const d = s.next_renewal ? new Date(s.next_renewal) : null;
            const days = d && !Number.isNaN(d.getTime()) ? Math.ceil((d.getTime() - Date.now()) / 86400000) : null;
            return (
              <li key={s.id} className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold truncate">{s.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{s.cycle} · {days !== null ? (days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? "today" : `in ${days}d`) : "—"}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-display text-lg">{fmtMoney(num(s.amount))}</span>
                  <button onClick={() => onEdit(s)} className="size-7 grid place-items-center text-muted-foreground"><Pencil className="size-3.5" /></button>
                  <button onClick={() => del.mutate(s.id)} className="size-7 grid place-items-center text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- INVESTMENTS ---------- */
function InvestmentsTab({ onEdit, onNew }: { onEdit: (i: any) => void; onNew: () => void }) {
  const qc = useQueryClient();
  const { invQ } = useFinanceData();
  const invs = invQ.data ?? [];
  const invested = invs.reduce((s, i) => s + num(i.invested), 0);
  const value = invs.reduce((s, i) => s + num(i.current_value), 0);
  const gain = value - invested;
  const pct = invested > 0 ? (gain / invested) * 100 : 0;

  // allocation by asset_type
  const byType: Record<string, number> = {};
  for (const i of invs) {
    const t = (i.asset_type ?? "other") as string;
    byType[t] = (byType[t] ?? 0) + num(i.current_value);
  }
  const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const palette = ["var(--nb-green)", "var(--nb-blue)", "var(--nb-orange)", "var(--nb-pink)", "var(--nb-yellow)", "var(--nb-ink)"];

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("investments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["investments"] }); toast.success("Removed"); },
    onError: (e) => toast.error(safeErrorMessage(e, "Couldn't delete")),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-[var(--nb-ink)] text-white border-[3px] border-[var(--nb-ink)] nb-shadow-lg p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--nb-green)] font-black">Portfolio value</p>
        <p className="font-display text-5xl mt-1 leading-none">{fmtMoney(value)}</p>
        <p className="mt-2 text-sm font-bold text-white/80">
          Invested {fmtMoney(invested)} · <span className={gain >= 0 ? "text-[color:var(--nb-green)]" : "text-[color:var(--nb-pink)]"}>{gain >= 0 ? "+" : ""}{fmtMoney(gain)} ({fmtPct(pct)})</span>
        </p>
      </div>

      {entries.length > 0 && (
        <NbCard title="Allocation">
          <div className="flex h-3 w-full rounded-full overflow-hidden border-[2px] border-[var(--nb-ink)] mb-3">
            {entries.map(([k, v], i) => <div key={k} style={{ width: `${(v / value) * 100}%`, background: palette[i % palette.length] }} />)}
          </div>
          <ul className="space-y-1.5">
            {entries.map(([k, v], i) => (
              <li key={k} className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2"><span className="size-3 rounded-sm border-[1.5px] border-[var(--nb-ink)]" style={{ background: palette[i % palette.length] }} /><span className="capitalize">{k.replace("_", " ")}</span></span>
                <span className="font-bold tabular-nums">{fmtMoney(v)} <span className="text-muted-foreground text-xs">{((v / value) * 100).toFixed(0)}%</span></span>
              </li>
            ))}
          </ul>
        </NbCard>
      )}

      <button onClick={onNew} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--nb-orange)] text-[var(--nb-ink)] px-4 py-3 text-sm font-black border-[3px] border-[var(--nb-ink)] nb-shadow tap-scale">
        <Plus className="size-4" strokeWidth={3} /> Add holding
      </button>

      {invs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No investments tracked yet.</p> : (
        <ul className="space-y-2.5">
          {invs.map(i => {
            const inv = num(i.invested); const cur = num(i.current_value);
            const change = inv > 0 ? ((cur - inv) / inv) * 100 : 0;
            return (
              <li key={i.id} className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold truncate">{i.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold capitalize">{(i.asset_type ?? "other").replace("_", " ")}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="text-right">
                    <p className="font-display text-base">{fmtMoney(cur)}</p>
                    <p className={cn("text-[11px] font-bold", change >= 0 ? "text-[color:var(--nb-green)]" : "text-[color:var(--nb-pink)]")}>{fmtPct(change)}</p>
                  </div>
                  <button onClick={() => onEdit(i)} className="size-7 grid place-items-center text-muted-foreground"><Pencil className="size-3.5" /></button>
                  <button onClick={() => del.mutate(i.id)} className="size-7 grid place-items-center text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- NET WORTH ---------- */
function NetWorthTab() {
  const qc = useQueryClient();
  const { accountsQ, liabilitiesQ, invQ } = useFinanceData();
  const accounts = accountsQ.data ?? [];
  const liabilities = liabilitiesQ.data ?? [];
  const cash = accounts.reduce((s, a) => s + num(a.balance), 0);
  const invValue = (invQ.data ?? []).reduce((s, i) => s + num(i.current_value), 0);
  const liabTotal = liabilities.reduce((s, l) => s + num(l.balance), 0);
  const assets = cash + invValue;
  const net = assets - liabTotal;

  const [accForm, setAccForm] = useState({ name: "", type: "bank", balance: "" });
  const [liabForm, setLiabForm] = useState({ name: "", type: "loan", balance: "" });

  const addAccount = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("");
      const { error } = await supabase.from("accounts" as any).insert({ user_id: user.id, name: accForm.name, type: accForm.type, balance: Number(accForm.balance) || 0 });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts"] }); setAccForm({ name: "", type: "bank", balance: "" }); toast.success("Account added"); },
    onError: (e) => toast.error(safeErrorMessage(e, "Couldn't add")),
  });
  const delAccount = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("accounts" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
    onError: (e) => toast.error(safeErrorMessage(e, "Couldn't delete")),
  });

  const addLiab = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("");
      const { error } = await supabase.from("liabilities" as any).insert({ user_id: user.id, name: liabForm.name, type: liabForm.type, balance: Number(liabForm.balance) || 0 });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["liabilities"] }); setLiabForm({ name: "", type: "loan", balance: "" }); toast.success("Liability added"); },
    onError: (e) => toast.error(safeErrorMessage(e, "Couldn't add")),
  });
  const delLiab = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("liabilities" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["liabilities"] }),
    onError: (e) => toast.error(safeErrorMessage(e, "Couldn't delete")),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-[var(--nb-ink)] text-white border-[3px] border-[var(--nb-ink)] nb-shadow-lg p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--nb-yellow)] font-black">Net worth</p>
        <p className="font-display text-5xl mt-1 leading-none">{fmtMoney(net)}</p>
        <p className="text-white/70 text-sm mt-2 font-bold">Assets {fmtMoney(assets)} − Liabilities {fmtMoney(liabTotal)}</p>
      </div>

      <NbCard title="Accounts (assets)">
        <div className="grid grid-cols-[1fr_110px_110px_auto] gap-1.5 mb-3">
          <input placeholder="Name" value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} className="rounded-lg bg-muted border-[2px] border-[var(--nb-ink)] px-2.5 py-1.5 text-sm" />
          <select value={accForm.type} onChange={(e) => setAccForm({ ...accForm, type: e.target.value })} className="rounded-lg bg-muted border-[2px] border-[var(--nb-ink)] px-2 py-1.5 text-xs">
            {["cash", "bank", "savings", "wallet", "credit_card", "investment"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" placeholder="Balance" value={accForm.balance} onChange={(e) => setAccForm({ ...accForm, balance: e.target.value })} className="rounded-lg bg-muted border-[2px] border-[var(--nb-ink)] px-2.5 py-1.5 text-sm" />
          <button onClick={() => accForm.name && addAccount.mutate()} className="rounded-lg bg-[var(--nb-green)] border-[2px] border-[var(--nb-ink)] px-3 py-1.5 text-xs font-black"><Plus className="size-3.5" strokeWidth={3} /></button>
        </div>
        {accounts.length === 0 ? <p className="text-sm text-muted-foreground text-center py-3">No accounts yet.</p> : (
          <ul className="divide-y divide-border/60">
            {accounts.map(a => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <div><p className="text-sm font-bold">{a.name}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{a.type}</p></div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-base">{fmtMoney(num(a.balance))}</span>
                  <button onClick={() => delAccount.mutate(a.id)} className="size-7 grid place-items-center text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </NbCard>

      <NbCard title="Liabilities">
        <div className="grid grid-cols-[1fr_110px_110px_auto] gap-1.5 mb-3">
          <input placeholder="Name" value={liabForm.name} onChange={(e) => setLiabForm({ ...liabForm, name: e.target.value })} className="rounded-lg bg-muted border-[2px] border-[var(--nb-ink)] px-2.5 py-1.5 text-sm" />
          <select value={liabForm.type} onChange={(e) => setLiabForm({ ...liabForm, type: e.target.value })} className="rounded-lg bg-muted border-[2px] border-[var(--nb-ink)] px-2 py-1.5 text-xs">
            {["loan", "credit_card", "mortgage", "other"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" placeholder="Balance" value={liabForm.balance} onChange={(e) => setLiabForm({ ...liabForm, balance: e.target.value })} className="rounded-lg bg-muted border-[2px] border-[var(--nb-ink)] px-2.5 py-1.5 text-sm" />
          <button onClick={() => liabForm.name && addLiab.mutate()} className="rounded-lg bg-[var(--nb-pink)] text-white border-[2px] border-[var(--nb-ink)] px-3 py-1.5 text-xs font-black"><Plus className="size-3.5" strokeWidth={3} /></button>
        </div>
        {liabilities.length === 0 ? <p className="text-sm text-muted-foreground text-center py-3">No liabilities. Nice.</p> : (
          <ul className="divide-y divide-border/60">
            {liabilities.map(l => (
              <li key={l.id} className="flex items-center justify-between py-2">
                <div><p className="text-sm font-bold">{l.name}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{l.type}</p></div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-base text-[color:var(--nb-pink)]">−{fmtMoney(num(l.balance))}</span>
                  <button onClick={() => delLiab.mutate(l.id)} className="size-7 grid place-items-center text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </NbCard>
    </div>
  );
}

/* ---------- GOALS (finance) ---------- */
function GoalsFinanceTab() {
  const qc = useQueryClient();
  const { goalsQ } = useFinanceData();
  const goals = goalsQ.data ?? [];
  const [form, setForm] = useState({ title: "", target_amount: "", current_amount: "" });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("");
      const t = Number(form.target_amount) || 0;
      const c = Number(form.current_amount) || 0;
      const progress = t > 0 ? Math.min(100, Math.round((c / t) * 100)) : 0;
      const { error } = await supabase.from("goals").insert({ user_id: user.id, title: form.title, kind: "finance", target_amount: t, current_amount: c, progress });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals_finance"] }); setForm({ title: "", target_amount: "", current_amount: "" }); toast.success("Goal added"); },
    onError: (e) => toast.error(safeErrorMessage(e, "Couldn't add")),
  });
  const contribute = useMutation({
    mutationFn: async ({ id, amount, currentNow, target }: { id: string; amount: number; currentNow: number; target: number }) => {
      const newCur = currentNow + amount;
      const progress = target > 0 ? Math.min(100, Math.round((newCur / target) * 100)) : 0;
      const { error } = await supabase.from("goals").update({ current_amount: newCur, progress }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals_finance"] }),
    onError: (e) => toast.error(safeErrorMessage(e, "Couldn't update")),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("goals").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals_finance"] }),
  });

  const financeGoals = goals.filter(g => g.kind === "finance" || g.target_amount);

  return (
    <div className="space-y-4">
      <NbCard title="New savings goal">
        <div className="grid grid-cols-[1fr_120px_120px_auto] gap-1.5">
          <input placeholder="e.g. Buy MacBook" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-lg bg-muted border-[2px] border-[var(--nb-ink)] px-2.5 py-1.5 text-sm" />
          <input type="number" placeholder="Target" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} className="rounded-lg bg-muted border-[2px] border-[var(--nb-ink)] px-2.5 py-1.5 text-sm" />
          <input type="number" placeholder="Saved so far" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} className="rounded-lg bg-muted border-[2px] border-[var(--nb-ink)] px-2.5 py-1.5 text-sm" />
          <button onClick={() => form.title && form.target_amount && add.mutate()} className="rounded-lg bg-[var(--nb-yellow)] border-[2px] border-[var(--nb-ink)] px-3 py-1.5 text-xs font-black"><Plus className="size-3.5" strokeWidth={3} /></button>
        </div>
      </NbCard>

      {financeGoals.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No savings goals yet.</p> : (
        <ul className="space-y-2.5">
          {financeGoals.map(g => {
            const t = num(g.target_amount); const c = num(g.current_amount);
            const pct = t > 0 ? Math.min(100, (c / t) * 100) : 0;
            return (
              <li key={g.id} className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-display text-lg truncate">{g.title}</p>
                  <button onClick={() => del.mutate(g.id)} className="size-7 grid place-items-center text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                </div>
                <div className="flex items-baseline justify-between mb-2 text-sm">
                  <span className="font-display text-2xl">{fmtMoney(c)}</span>
                  <span className="text-muted-foreground">of {fmtMoney(t)} · {pct.toFixed(0)}%</span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden border-[2px] border-[var(--nb-ink)] mb-3">
                  <div className="h-full bg-[var(--nb-orange)] transition-[width] duration-700" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[500, 1000, 5000].map(a => (
                    <button key={a} onClick={() => contribute.mutate({ id: g.id, amount: a, currentNow: c, target: t })} className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-muted border-[2px] border-[var(--nb-ink)] tap-scale">+{fmtMoney(a)}</button>
                  ))}
                  <button onClick={() => {
                    const v = prompt("Contribution amount"); if (!v) return;
                    const n = Number(v); if (!Number.isFinite(n) || n <= 0) return;
                    contribute.mutate({ id: g.id, amount: n, currentNow: c, target: t });
                  }} className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-[var(--nb-green)] border-[2px] border-[var(--nb-ink)] tap-scale">Custom</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- CALENDAR ---------- */
function CalendarTab() {
  const [cursor, setCursor] = useState(() => new Date());
  const { subsQ } = useFinanceData();
  const { txs } = useAllTx();

  const year = cursor.getFullYear(); const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  // events per day
  const events: Record<string, { type: string; label: string; tint: string }[]> = {};
  for (const s of subsQ.data ?? []) {
    if (!s.next_renewal) continue;
    const d = new Date(s.next_renewal);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const k = dayKey(d);
      (events[k] ??= []).push({ type: "sub", label: s.name, tint: "var(--nb-pink)" });
    }
  }
  for (const t of txs) {
    if (!t.occurred_on || !t.recurring) continue;
    const d = new Date(t.occurred_on);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const k = dayKey(d);
      (events[k] ??= []).push({ type: t.type, label: t.note || t.type, tint: t.type === "income" ? "var(--nb-green)" : "var(--nb-blue)" });
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date(); const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  return (
    <div className="space-y-4">
      <NbCard>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setCursor(addMonths(cursor, -1))} className="size-9 grid place-items-center rounded-lg border-[2.5px] border-[var(--nb-ink)] bg-card"><ChevronLeft className="size-4" /></button>
          <p className="font-display text-xl">{monthLabel(cursor)}</p>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="size-9 grid place-items-center rounded-lg border-[2.5px] border-[var(--nb-ink)] bg-card"><ChevronRight className="size-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-widest text-muted-foreground font-black mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="text-center py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const k = dayKey(new Date(year, month, d));
            const evs = events[k] ?? [];
            return (
              <div key={i} className={cn("aspect-square rounded-lg border-[2px] p-1 flex flex-col", isToday(d) ? "bg-[var(--nb-yellow)] border-[var(--nb-ink)]" : "bg-card border-border/40")}>
                <div className="text-[10px] font-black">{d}</div>
                <div className="flex flex-wrap gap-0.5 mt-auto">
                  {evs.slice(0, 3).map((e, j) => <span key={j} className="size-1.5 rounded-full border-[1px] border-[var(--nb-ink)]" style={{ background: e.tint }} title={e.label} />)}
                </div>
              </div>
            );
          })}
        </div>
      </NbCard>
      <NbCard title="This month's renewals">
        {(subsQ.data ?? []).filter(s => {
          if (!s.next_renewal) return false;
          const d = new Date(s.next_renewal);
          return d.getFullYear() === year && d.getMonth() === month;
        }).sort((a, b) => (a.next_renewal || "").localeCompare(b.next_renewal || "")).map(s => (
          <div key={s.id} className="flex items-center justify-between py-1.5 text-sm">
            <span className="font-bold">{s.name}</span>
            <span className="text-muted-foreground">{s.next_renewal} · <span className="text-foreground font-bold">{fmtMoney(num(s.amount))}</span></span>
          </div>
        ))}
        {(subsQ.data ?? []).filter(s => {
          if (!s.next_renewal) return false;
          const d = new Date(s.next_renewal); return d.getFullYear() === year && d.getMonth() === month;
        }).length === 0 && <p className="text-sm text-muted-foreground text-center py-3">No renewals this month.</p>}
      </NbCard>
    </div>
  );
}

/* ---------- INSIGHTS ---------- */
function InsightsTab() {
  const { txs } = useAllTx();
  const { subsQ, goalsQ } = useFinanceData();
  const now = new Date();
  const month = firstOfMonth(now);
  const next = firstOfMonth(addMonths(now, 1));
  const prev = firstOfMonth(addMonths(now, -1));

  const inRange = (t: any, from: string, to: string) => t.occurred_on >= from && t.occurred_on < to;
  const spendThis = txs.filter(t => t.type === "expense" && inRange(t, month, next)).reduce((s, t) => s + t.amount, 0);
  const spendPrev = txs.filter(t => t.type === "expense" && inRange(t, prev, month)).reduce((s, t) => s + t.amount, 0);
  const incomeThis = txs.filter(t => t.type === "income" && inRange(t, month, next)).reduce((s, t) => s + t.amount, 0);
  const subsTotal = (subsQ.data ?? []).reduce((s, x) => s + (x.cycle === "yearly" ? num(x.amount) / 12 : x.cycle === "weekly" ? num(x.amount) * 4.33 : num(x.amount)), 0);
  const savingsRate = incomeThis > 0 ? ((incomeThis - spendThis) / incomeThis) * 100 : 0;

  const insights: { tint: string; title: string; body: string }[] = [];
  if (spendPrev > 0) {
    const delta = ((spendThis - spendPrev) / spendPrev) * 100;
    insights.push({
      tint: delta > 10 ? "var(--nb-pink)" : delta < -10 ? "var(--nb-green)" : "var(--nb-yellow)",
      title: delta > 0 ? `Spending up ${delta.toFixed(0)}%` : `Spending down ${Math.abs(delta).toFixed(0)}%`,
      body: `You've spent ${fmtMoney(spendThis)} this month vs ${fmtMoney(spendPrev)} last month.`,
    });
  }
  if (subsTotal > 0) {
    insights.push({ tint: "var(--nb-blue)", title: `Subscriptions cost ${fmtMoney(subsTotal)}/mo`, body: `That's ${fmtMoney(subsTotal * 12)} a year. Audit what you actually use.` });
  }
  if (incomeThis > 0) {
    insights.push({
      tint: savingsRate >= 20 ? "var(--nb-green)" : savingsRate >= 0 ? "var(--nb-yellow)" : "var(--nb-pink)",
      title: `Savings rate: ${savingsRate.toFixed(0)}%`,
      body: savingsRate >= 20 ? "Crushing it — keep this pace." : savingsRate >= 0 ? "Solid, push toward 20% next month." : "Spending exceeds income this month.",
    });
  }
  for (const g of (goalsQ.data ?? []).filter(g => g.kind === "finance" && g.target_amount)) {
    const t = num(g.target_amount); const c = num(g.current_amount);
    if (t <= c) continue;
    const remaining = t - c;
    const savings = incomeThis - spendThis;
    if (savings > 0) {
      const months = Math.ceil(remaining / savings);
      insights.push({ tint: "var(--nb-orange)", title: `${g.title} in ~${months} mo`, body: `At your current saving pace (${fmtMoney(savings)}/mo) you'll hit ${fmtMoney(t)}.` });
    }
  }

  if (insights.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">Add some transactions to unlock insights.</p>;
  }

  return (
    <ul className="space-y-3">
      {insights.map((ins, i) => (
        <li key={i} className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-4 flex gap-3">
          <span className="grid place-items-center size-10 rounded-lg border-[2.5px] border-[var(--nb-ink)] shrink-0" style={{ background: ins.tint }}>
            <Sparkles className="size-5" strokeWidth={3} />
          </span>
          <div>
            <p className="font-display text-lg leading-tight">{ins.title}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{ins.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- FAB ---------- */
function FinanceFab({ open, setOpen, onPick }: { open: boolean; setOpen: (b: boolean) => void; onPick: (t: "income" | "expense" | "transfer" | "investment" | "subscription") => void }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} />}
      <div className="fixed right-4 z-50 flex flex-col items-end gap-2" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 108px)" }}>
        {open && (
          <div className="flex flex-col items-end gap-2 mb-1">
            <FabItem label="Expense" tint="var(--nb-pink)" icon={TrendingDown} onClick={() => onPick("expense")} />
            <FabItem label="Income" tint="var(--nb-green)" icon={TrendingUp} onClick={() => onPick("income")} />
            <FabItem label="Investment" tint="var(--nb-orange)" icon={LineIcon} onClick={() => onPick("investment")} />
            <FabItem label="Subscription" tint="var(--nb-blue)" icon={Repeat} onClick={() => onPick("subscription")} />
          </div>
        )}
        <button
          onClick={() => setOpen(!open)}
          className="size-14 rounded-2xl bg-[var(--nb-yellow)] border-[3px] border-[var(--nb-ink)] nb-shadow-lg grid place-items-center tap-scale"
          aria-label="Quick add"
        >
          {open ? <X className="size-6" strokeWidth={3} /> : <Plus className="size-6" strokeWidth={3} />}
        </button>
      </div>
    </>
  );
}
function FabItem({ label, tint, icon: Icon, onClick }: { label: string; tint: string; icon: any; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 pl-3 pr-4 py-2 rounded-xl border-[2.5px] border-[var(--nb-ink)] nb-shadow text-xs font-black uppercase tracking-widest tap-scale" style={{ background: tint }}>
      <Icon className="size-4" strokeWidth={3} /> {label}
    </button>
  );
}

/* ---------- Quick Sheet (Add/Edit) ---------- */
function QuickSheet({ mode, onClose }: { mode: { type: "income" | "expense" | "transfer" | "investment" | "subscription"; id?: string; prefill?: any }; onClose: () => void }) {
  const qc = useQueryClient();
  const { accountsQ, categoriesQ } = useFinanceData();
  const accounts = accountsQ.data ?? [];
  const categories = (categoriesQ.data ?? []).filter(c =>
    mode.type === "income" ? c.kind === "income" : c.kind === "expense"
  );

  // Transaction-like (income/expense/transfer/investment)
  const isTx = mode.type !== "subscription";
  const isInvestment = mode.type === "investment";
  const isSubscription = mode.type === "subscription";

  const [amount, setAmount] = useState<string>(String(mode.prefill?.amount ?? mode.prefill?.invested ?? ""));
  const [note, setNote] = useState<string>(mode.prefill?.note ?? mode.prefill?.name ?? "");
  const [date, setDate] = useState<string>(mode.prefill?.occurred_on ?? mode.prefill?.next_renewal ?? today());
  const [categoryId, setCategoryId] = useState<string>(mode.prefill?.category_id ?? "");
  const [accountId, setAccountId] = useState<string>(mode.prefill?.account_id ?? "");
  const [toAccountId, setToAccountId] = useState<string>(mode.prefill?.to_account_id ?? "");
  const [recurring, setRecurring] = useState<boolean>(!!mode.prefill?.recurring);
  // investment-specific
  const [assetType, setAssetType] = useState<string>(mode.prefill?.asset_type ?? "stock");
  const [currentValue, setCurrentValue] = useState<string>(String(mode.prefill?.current_value ?? ""));
  // subscription-specific
  const [cycle, setCycle] = useState<string>(mode.prefill?.cycle ?? "monthly");

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("");
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt < 0) throw new Error("Enter a valid amount");

      if (isSubscription) {
        const payload = { user_id: user.id, name: note || "Subscription", amount: amt, cycle, next_renewal: date };
        if (mode.id) {
          const { error } = await supabase.from("subscriptions").update(payload).eq("id", mode.id); if (error) throw error;
        } else {
          const { error } = await supabase.from("subscriptions").insert(payload); if (error) throw error;
        }
      } else if (isInvestment) {
        const payload = { user_id: user.id, name: note || "Holding", asset_type: assetType, invested: amt, current_value: Number(currentValue) || amt };
        if (mode.id) {
          const { error } = await supabase.from("investments").update(payload).eq("id", mode.id); if (error) throw error;
        } else {
          const { error } = await supabase.from("investments").insert(payload); if (error) throw error;
        }
      } else {
        const payload: any = {
          user_id: user.id,
          type: mode.type,
          amount: amt,
          note: note || null,
          category_id: categoryId || null,
          account_id: accountId || null,
          to_account_id: mode.type === "transfer" ? (toAccountId || null) : null,
          occurred_on: date,
          recurring,
        };
        if (mode.id) {
          const { error } = await supabase.from("transactions" as any).update(payload).eq("id", mode.id); if (error) throw error;
        } else {
          const { error } = await supabase.from("transactions" as any).insert(payload); if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["investments"] });
      toast.success(mode.id ? "Updated" : "Added");
      onClose();
    },
    onError: (e) => toast.error(safeErrorMessage(e, "Couldn't save")),
  });

  const title = mode.id ? `Edit ${mode.type}` : `Add ${mode.type}`;
  const tint = mode.type === "income" ? "var(--nb-green)" : mode.type === "expense" ? "var(--nb-pink)" : mode.type === "transfer" ? "var(--nb-blue)" : mode.type === "investment" ? "var(--nb-orange)" : "var(--nb-yellow)";

  return (
    <div className="fixed inset-0 z-50 grid place-items-end md:place-items-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border-t-[3px] md:border-[3px] border-[var(--nb-ink)] nb-shadow-lg md:rounded-2xl rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2">
            <span className="size-8 grid place-items-center rounded-lg border-[2.5px] border-[var(--nb-ink)]" style={{ background: tint }}><Plus className="size-4" strokeWidth={3} /></span>
            <h2 className="font-display text-2xl capitalize">{title}</h2>
          </div>
          <button onClick={onClose} className="size-9 grid place-items-center rounded-lg border-[2.5px] border-[var(--nb-ink)]"><X className="size-4" /></button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <Field label="Amount">
            <input type="number" step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full rounded-xl bg-muted border-[2.5px] border-[var(--nb-ink)] px-3 py-2.5 text-lg font-display" />
          </Field>

          <Field label={isSubscription ? "Service name" : isInvestment ? "Holding name" : "Note"}>
            <input value={note} onChange={(e) => setNote(e.target.value)} required={isSubscription || isInvestment} className="w-full rounded-xl bg-muted border-[2.5px] border-[var(--nb-ink)] px-3 py-2 text-sm" />
          </Field>

          {isTx && !isInvestment && categories.length > 0 && (
            <Field label="Category">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-xl bg-muted border-[2.5px] border-[var(--nb-ink)] px-3 py-2 text-sm">
                <option value="">— None —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}

          {isTx && !isInvestment && accounts.length > 0 && (
            <Field label={mode.type === "transfer" ? "From account" : "Account"}>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded-xl bg-muted border-[2.5px] border-[var(--nb-ink)] px-3 py-2 text-sm">
                <option value="">— None —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}

          {mode.type === "transfer" && accounts.length > 0 && (
            <Field label="To account">
              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className="w-full rounded-xl bg-muted border-[2.5px] border-[var(--nb-ink)] px-3 py-2 text-sm">
                <option value="">— None —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}

          {isInvestment && (
            <>
              <Field label="Asset type">
                <select value={assetType} onChange={(e) => setAssetType(e.target.value)} className="w-full rounded-xl bg-muted border-[2.5px] border-[var(--nb-ink)] px-3 py-2 text-sm">
                  {["stock", "mutual_fund", "etf", "sip", "fixed_deposit", "crypto", "savings", "other"].map(a => <option key={a} value={a}>{a.replace("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Current value">
                <input type="number" step="0.01" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} className="w-full rounded-xl bg-muted border-[2.5px] border-[var(--nb-ink)] px-3 py-2 text-sm" />
              </Field>
            </>
          )}

          {isSubscription && (
            <Field label="Billing cycle">
              <select value={cycle} onChange={(e) => setCycle(e.target.value)} className="w-full rounded-xl bg-muted border-[2.5px] border-[var(--nb-ink)] px-3 py-2 text-sm">
                <option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="weekly">Weekly</option>
              </select>
            </Field>
          )}

          <Field label={isSubscription ? "Next renewal" : "Date"}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl bg-muted border-[2.5px] border-[var(--nb-ink)] px-3 py-2 text-sm" />
          </Field>

          {isTx && !isInvestment && (
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="size-4 accent-[var(--nb-ink)]" />
              Recurring
            </label>
          )}

          <button type="submit" disabled={save.isPending} className="w-full rounded-xl bg-[var(--nb-ink)] text-white px-4 py-3 text-sm font-black border-[3px] border-[var(--nb-ink)] nb-shadow tap-scale disabled:opacity-50">
            {save.isPending ? "Saving…" : mode.id ? "Save changes" : "Add"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black block mb-1">{label}</span>
      {children}
    </label>
  );
}
