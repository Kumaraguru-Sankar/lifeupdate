import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Repeat, LineChart as LineIcon, Plus, Trash2, Calendar, Pencil } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/finance")({ component: FinancePage });

const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

const CAT_COLORS: Record<string, string> = {
  food: "oklch(0.72 0.15 25)",
  travel: "oklch(0.72 0.13 200)",
  shopping: "oklch(0.7 0.13 320)",
  bills: "oklch(0.75 0.13 55)",
  entertainment: "oklch(0.7 0.13 280)",
  health: "oklch(0.72 0.13 145)",
  education: "oklch(0.65 0.13 230)",
  misc: "oklch(0.6 0.02 60)",
};

const ASSET_COLORS: Record<string, string> = {
  stock: "oklch(0.7 0.15 200)",
  mutual_fund: "oklch(0.72 0.13 55)",
  crypto: "oklch(0.7 0.18 320)",
  sip: "oklch(0.72 0.13 145)",
  savings: "oklch(0.65 0.02 60)",
  other: "oklch(0.55 0.02 60)",
};

function FinancePage() {
  return (
    <AppShell title="Finance" subtitle="Money Operating System">
      <div className="space-y-8">
        <Overview />
        <div className="grid gap-5 lg:grid-cols-2">
          <Spending />
          <IncomeVsExpense />
        </div>
        <Expenses />
        <Incomes />
        <div className="grid gap-5 lg:grid-cols-2">
          <Subscriptions />
          <Investments />
        </div>
      </div>
    </AppShell>
  );
}

function SectionTitle({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-4">
      {eyebrow && <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1.5">{eyebrow}</p>}
      <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight">{children}</h2>
    </div>
  );
}
function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-3xl bg-card border border-border/60 shadow-soft p-5 lg:p-6 ${className}`}>{children}</div>;
}

/* ---------- Overview ---------- */

function useFinance() {
  const since = monthStart();
  const expensesQ = useQuery({
    queryKey: ["expenses_month", since],
    queryFn: async () => {
      const { data } = await supabase.from("expenses").select("*").gte("spent_on", since).order("spent_on", { ascending: false });
      return (data ?? []) as any[];
    },
  });
  const incomesQ = useQuery({
    queryKey: ["incomes_month", since],
    queryFn: async () => {
      const { data } = await supabase.from("incomes").select("*").gte("received_on", since).order("received_on", { ascending: false });
      return (data ?? []) as any[];
    },
  });
  const subsQ = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("*").order("next_renewal");
      return (data ?? []) as any[];
    },
  });
  const invQ = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data } = await supabase.from("investments").select("*").order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });
  return { expensesQ, incomesQ, subsQ, invQ };
}

function Overview() {
  const { expensesQ, incomesQ, subsQ, invQ } = useFinance();
  const expenses = expensesQ.data ?? []; const incomes = incomesQ.data ?? [];
  const subs = subsQ.data ?? []; const invs = invQ.data ?? [];

  const income = incomes.reduce((s, i) => s + Number(i.amount), 0);
  const spent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const subTotal = subs.reduce((s, x) => s + (x.cycle === "yearly" ? Number(x.amount) / 12 : x.cycle === "weekly" ? Number(x.amount) * 4.33 : Number(x.amount)), 0);
  const invested = invs.reduce((s, i) => s + Number(i.invested), 0);
  const value = invs.reduce((s, i) => s + Number(i.current_value), 0);
  const savings = income - spent;

  return (
    <section>
      <SectionTitle eyebrow="This month">Financial overview</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BigStat icon={<Wallet />} label="Balance" value={income - spent} tone={income - spent >= 0 ? "ok" : "warn"} primary />
        <BigStat icon={<TrendingUp />} label="Income" value={income} tone="ok" />
        <BigStat icon={<TrendingDown />} label="Spending" value={spent} tone="warn" />
        <BigStat icon={<PiggyBank />} label="Savings" value={savings} />
        <BigStat icon={<LineIcon />} label="Investments" value={value} sub={`${invested ? Math.round(((value - invested) / invested) * 100) : 0}% growth`} />
        <BigStat icon={<Repeat />} label="Subscriptions" value={subTotal} sub="per month" />
      </div>
    </section>
  );
}

function BigStat({ icon, label, value, sub, tone, primary }: { icon: React.ReactNode; label: string; value: number; sub?: string; tone?: "ok" | "warn"; primary?: boolean }) {
  return (
    <div className={`rounded-3xl border p-5 lg:p-6 shadow-soft ${primary ? "bg-gradient-to-br from-foreground to-foreground/80 text-background border-transparent" : "bg-card border-border/60"}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] uppercase tracking-[0.22em] ${primary ? "text-background/70" : "text-muted-foreground"}`}>{label}</span>
        <span className={primary ? "text-background/80" : "text-muted-foreground"}>{icon}</span>
      </div>
      <p className={`font-display text-4xl lg:text-5xl font-semibold mt-2 ${tone === "warn" && !primary ? "text-destructive" : tone === "ok" && !primary ? "text-accent" : ""}`}>
        ${Math.round(value).toLocaleString()}
      </p>
      {sub && <p className={`text-xs mt-1 ${primary ? "text-background/70" : "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
}

/* ---------- Spending pie ---------- */

function Spending() {
  const { expensesQ } = useFinance();
  const data = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const e of expensesQ.data ?? []) byCat[e.category] = (byCat[e.category] ?? 0) + Number(e.amount);
    return Object.entries(byCat).map(([name, value]) => ({ name, value }));
  }, [expensesQ.data]);

  return (
    <Card>
      <SectionTitle eyebrow="Distribution">Spending by category</SectionTitle>
      {data.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Log expenses to see your spending mix.</p> : (
        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {data.map(d => <Cell key={d.name} fill={CAT_COLORS[d.name] ?? "var(--accent)"} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => `$${v}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function IncomeVsExpense() {
  const { incomesQ, expensesQ } = useFinance();
  const data = useMemo(() => {
    const map: Record<string, { day: string; income: number; expense: number }> = {};
    const init = (d: string) => (map[d] ??= { day: d.slice(5), income: 0, expense: 0 });
    for (const i of incomesQ.data ?? []) init(i.received_on).income += Number(i.amount);
    for (const e of expensesQ.data ?? []) init(e.spent_on).expense += Number(e.amount);
    return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
  }, [incomesQ.data, expensesQ.data]);

  return (
    <Card>
      <SectionTitle eyebrow="Flow">Income vs expense</SectionTitle>
      {data.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No activity yet this month.</p> : (
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data}>
              <XAxis dataKey="day" stroke="oklch(from var(--muted-foreground) l c h / 0.6)" fontSize={10} />
              <YAxis stroke="oklch(from var(--muted-foreground) l c h / 0.6)" fontSize={10} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="income" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" fill="oklch(0.6 0.2 25)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* ---------- Expenses ---------- */

const EXP_CATS = ["food", "travel", "shopping", "bills", "entertainment", "health", "education", "misc"] as const;

function Expenses() {
  const qc = useQueryClient();
  const { expensesQ } = useFinance();
  const [form, setForm] = useState({ category: "food", amount: "", note: "" });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("");
      await supabase.from("expenses").insert({ user_id: user.id, spent_on: today(), category: form.category, amount: +form.amount, note: form.note || null });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses_month"] }); setForm({ ...form, amount: "", note: "" }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("expenses").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses_month"] }),
  });

  return (
    <section>
      <SectionTitle eyebrow="Outflow">Expenses</SectionTitle>
      <Card className="mb-3">
        <div className="grid md:grid-cols-[140px_1fr_120px_auto] gap-2">
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="rounded-lg bg-muted px-3 py-2 text-sm">
            {EXP_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="rounded-lg bg-muted px-3 py-2 text-sm" placeholder="Note (optional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          <input type="number" className="rounded-lg bg-muted px-3 py-2 text-sm" placeholder="$ amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          <button onClick={() => form.amount && add.mutate()} className="rounded-lg bg-foreground text-background px-4 py-2 text-sm inline-flex items-center gap-2 tap-scale"><Plus className="size-4" /> Add</button>
        </div>
      </Card>
      <Card className="!p-0 overflow-hidden">
        {(expensesQ.data ?? []).length === 0 ? <p className="p-6 text-sm text-muted-foreground text-center">No expenses yet.</p> : (
          <ul className="divide-y divide-border/60">
            {(expensesQ.data ?? []).slice(0, 12).map(e => (
              <li key={e.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="size-2.5 rounded-full shrink-0" style={{ background: CAT_COLORS[e.category] }} />
                  <div className="min-w-0">
                    <p className="text-sm capitalize truncate">{e.note || e.category}</p>
                    <p className="text-[11px] text-muted-foreground">{e.category} · {e.spent_on}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-display text-lg">${Number(e.amount).toLocaleString()}</span>
                  <button onClick={() => del.mutate(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

/* ---------- Incomes ---------- */

const INC_SRC = ["salary", "freelance", "passive", "other"] as const;

function Incomes() {
  const qc = useQueryClient();
  const { incomesQ } = useFinance();
  const [form, setForm] = useState({ source: "salary", amount: "", note: "" });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("");
      await supabase.from("incomes").insert({ user_id: user.id, received_on: today(), source: form.source, amount: +form.amount, note: form.note || null });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incomes_month"] }); setForm({ ...form, amount: "", note: "" }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("incomes").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incomes_month"] }),
  });

  return (
    <section>
      <SectionTitle eyebrow="Inflow">Income</SectionTitle>
      <Card className="mb-3">
        <div className="grid md:grid-cols-[140px_1fr_120px_auto] gap-2">
          <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="rounded-lg bg-muted px-3 py-2 text-sm">
            {INC_SRC.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="rounded-lg bg-muted px-3 py-2 text-sm" placeholder="Note (optional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          <input type="number" className="rounded-lg bg-muted px-3 py-2 text-sm" placeholder="$ amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          <button onClick={() => form.amount && add.mutate()} className="rounded-lg bg-foreground text-background px-4 py-2 text-sm inline-flex items-center gap-2 tap-scale"><Plus className="size-4" /> Add</button>
        </div>
      </Card>
      <Card className="!p-0 overflow-hidden">
        {(incomesQ.data ?? []).length === 0 ? <p className="p-6 text-sm text-muted-foreground text-center">No income logged.</p> : (
          <ul className="divide-y divide-border/60">
            {(incomesQ.data ?? []).slice(0, 10).map(i => (
              <li key={i.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm capitalize truncate">{i.note || i.source}</p>
                  <p className="text-[11px] text-muted-foreground">{i.source} · {i.received_on}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-display text-lg text-accent">+${Number(i.amount).toLocaleString()}</span>
                  <button onClick={() => del.mutate(i.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

/* ---------- Subscriptions ---------- */

function Subscriptions() {
  const qc = useQueryClient();
  const { subsQ } = useFinance();
  const [form, setForm] = useState({ name: "", amount: "", cycle: "monthly", next_renewal: today() });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("");
      await supabase.from("subscriptions").insert({ user_id: user.id, name: form.name, amount: +form.amount, cycle: form.cycle, next_renewal: form.next_renewal });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscriptions"] }); setForm({ ...form, name: "", amount: "" }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("subscriptions").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  return (
    <Card>
      <SectionTitle eyebrow="Recurring">Subscriptions</SectionTitle>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <input className="rounded-lg bg-muted px-3 py-2 text-sm col-span-2" placeholder="Service name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input type="number" className="rounded-lg bg-muted px-3 py-2 text-sm" placeholder="$ amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        <select value={form.cycle} onChange={e => setForm({ ...form, cycle: e.target.value })} className="rounded-lg bg-muted px-3 py-2 text-sm">
          <option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="weekly">Weekly</option>
        </select>
        <input type="date" className="rounded-lg bg-muted px-3 py-2 text-sm col-span-2" value={form.next_renewal} onChange={e => setForm({ ...form, next_renewal: e.target.value })} />
      </div>
      <button onClick={() => form.name && form.amount && add.mutate()} className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm tap-scale mb-3">Add subscription</button>
      <ul className="divide-y divide-border/60">
        {(subsQ.data ?? []).map(s => {
          const days = Math.ceil((new Date(s.next_renewal).getTime() - Date.now()) / 86400000);
          return (
            <li key={s.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Calendar className="size-3" /> {s.cycle} · in {days}d</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-display text-lg">${Number(s.amount).toLocaleString()}</span>
                <button onClick={() => del.mutate(s.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------- Investments ---------- */

const ASSETS = ["stock", "mutual_fund", "crypto", "sip", "savings", "other"] as const;

function Investments() {
  const qc = useQueryClient();
  const { invQ } = useFinance();
  const [form, setForm] = useState({ name: "", asset_type: "stock", invested: "", current_value: "" });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("");
      await supabase.from("investments").insert({ user_id: user.id, name: form.name, asset_type: form.asset_type, invested: +form.invested, current_value: +form.current_value });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["investments"] }); setForm({ ...form, name: "", invested: "", current_value: "" }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("investments").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investments"] }),
  });

  const data = useMemo(() => (invQ.data ?? []).map(i => ({ name: i.name, value: Number(i.current_value), type: i.asset_type })), [invQ.data]);

  return (
    <Card>
      <SectionTitle eyebrow="Portfolio">Investments</SectionTitle>
      {data.length > 0 && (
        <div className="h-44 mb-3">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                {data.map((d, i) => <Cell key={i} fill={ASSET_COLORS[d.type] ?? "var(--accent)"} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => `$${v}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <input className="rounded-lg bg-muted px-3 py-2 text-sm col-span-2" placeholder="Asset name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <select value={form.asset_type} onChange={e => setForm({ ...form, asset_type: e.target.value })} className="rounded-lg bg-muted px-3 py-2 text-sm col-span-2">
          {ASSETS.map(a => <option key={a} value={a}>{a.replace("_", " ")}</option>)}
        </select>
        <input type="number" className="rounded-lg bg-muted px-3 py-2 text-sm" placeholder="Invested $" value={form.invested} onChange={e => setForm({ ...form, invested: e.target.value })} />
        <input type="number" className="rounded-lg bg-muted px-3 py-2 text-sm" placeholder="Current $" value={form.current_value} onChange={e => setForm({ ...form, current_value: e.target.value })} />
      </div>
      <button onClick={() => form.name && add.mutate()} className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm tap-scale mb-3">Add holding</button>
      <ul className="divide-y divide-border/60">
        {(invQ.data ?? []).map(i => {
          const change = ((Number(i.current_value) - Number(i.invested)) / Math.max(1, Number(i.invested))) * 100;
          return (
            <li key={i.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{i.name}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{i.asset_type.replace("_", " ")}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="font-display text-base">${Number(i.current_value).toLocaleString()}</p>
                  <p className={`text-[11px] ${change >= 0 ? "text-accent" : "text-destructive"}`}>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</p>
                </div>
                <button onClick={() => del.mutate(i.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
