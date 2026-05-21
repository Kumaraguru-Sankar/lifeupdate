import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Sun, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Review = { id: string; review_date: string; wins: string; lessons: string; tomorrow: string; energy: number };

export const Route = createFileRoute("/_authenticated/review")({ component: Review });

function Review() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: review } = useQuery({
    queryKey: ["review", today],
    queryFn: async () => {
      const { data } = await supabase.from("daily_reviews").select("*").eq("review_date", today).maybeSingle();
      return data as Review | null;
    },
  });

  const [wins, setWins] = useState(""); const [lessons, setLessons] = useState("");
  const [tomorrow, setTomorrow] = useState(""); const [energy, setEnergy] = useState(3);

  useEffect(() => {
    if (review) { setWins(review.wins ?? ""); setLessons(review.lessons ?? ""); setTomorrow(review.tomorrow ?? ""); setEnergy(review.energy ?? 3); }
  }, [review?.id]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const payload = { user_id: user.id, review_date: today, wins, lessons, tomorrow, energy };
      const { error } = await supabase.from("daily_reviews").upsert(payload, { onConflict: "user_id,review_date" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["review"] }); toast.success("Review saved"); },
  });

  return (
    <AppShell title="Daily Review" subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}>
      <p className="text-sm text-muted-foreground -mt-2 mb-6 leading-relaxed">A few quiet minutes to close the day. Notice what worked, what didn't, what's next.</p>

      <Section icon={<Sun className="size-4" />} label="Energy today">
        <div className="flex gap-2 justify-between">
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setEnergy(n)} className={cn("flex-1 h-12 rounded-xl text-sm transition-all tap-scale", energy === n ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground hover:bg-muted")}>{n}</button>
          ))}
        </div>
      </Section>

      <Section label="Wins">
        <Area value={wins} onChange={setWins} placeholder="What went well today?" />
      </Section>
      <Section label="Lessons">
        <Area value={lessons} onChange={setLessons} placeholder="What did you learn?" />
      </Section>
      <Section label="Tomorrow">
        <Area value={tomorrow} onChange={setTomorrow} placeholder="One thing you'll prioritize tomorrow." />
      </Section>

      <button onClick={() => save.mutate()} className="w-full mt-2 rounded-2xl bg-foreground text-background h-12 inline-flex items-center justify-center gap-2 tap-scale shadow-lift">
        <Check className="size-4" /> Save review
      </button>
    </AppShell>
  );
}

function Section({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2 px-1">{icon}{label}</div>
      <div className="rounded-2xl bg-card border border-border/60 p-3 shadow-soft">{children}</div>
    </section>
  );
}
function Area({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full bg-transparent outline-none text-[15px] leading-relaxed resize-none placeholder:text-muted-foreground" />;
}
