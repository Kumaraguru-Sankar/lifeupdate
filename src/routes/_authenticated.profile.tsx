import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { Moon, Sun, LogOut, Mail, User as UserIcon, LifeBuoy, Check } from "lucide-react";
import { toast } from "sonner";
import { useBadges, syncBadges } from "@/lib/badges";
import { useEffect as useEffectOnce } from "react";

export const Route = createFileRoute("/_authenticated/profile")({ component: Profile });

const DEVELOPER_EMAIL = "hello@lifeupdate.app";

function Profile() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      return { email: user.email ?? "", displayName: profile?.display_name ?? "" };
    },
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (me) {
      setName(me.displayName);
      setEmail(me.email);
    }
  }, [me]);

  const saveName = useMutation({
    mutationFn: async (displayName: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Name updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEmail = useMutation({
    mutationFn: async (newEmail: string) => {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Check your inbox to confirm the new email"),
    onError: (e: Error) => toast.error(e.message),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/login" });
  };

  return (
    <AppShell title="Profile" subtitle="Your account">
      <Card title="Account">
        <Field icon={<UserIcon className="size-4" />} label="Display name">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground"
              placeholder="Your name"
            />
            {me && name !== me.displayName && name.trim().length > 0 && (
              <button
                onClick={() => saveName.mutate(name.trim())}
                className="text-xs px-3 py-1.5 rounded-full bg-accent text-accent-foreground inline-flex items-center gap-1"
              >
                <Check className="size-3" /> Save
              </button>
            )}
          </div>
        </Field>

        <Field icon={<Mail className="size-4" />} label="Email">
          <div className="flex gap-2">
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground"
              placeholder="you@example.com"
            />
            {me && email !== me.email && email.includes("@") && (
              <button
                onClick={() => saveEmail.mutate(email.trim())}
                className="text-xs px-3 py-1.5 rounded-full bg-accent text-accent-foreground inline-flex items-center gap-1"
              >
                <Check className="size-3" /> Update
              </button>
            )}
          </div>
        </Field>
      </Card>

      <Card title="Appearance">
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-3 text-[15px]">
            {theme === "dark" ? <Moon className="size-4 text-muted-foreground" /> : <Sun className="size-4 text-muted-foreground" />}
            Dark mode
          </span>
          <span
            className={`relative h-6 w-11 rounded-full transition-colors ${theme === "dark" ? "bg-accent" : "bg-muted"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all ${theme === "dark" ? "left-[22px]" : "left-0.5"}`}
            />
          </span>
        </button>
      </Card>

      <Card title="Support">
        <a
          href={`mailto:${DEVELOPER_EMAIL}?subject=LifeUpdate%20feedback`}
          className="flex items-center justify-between px-4 py-4 hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-3 text-[15px]">
            <LifeBuoy className="size-4 text-muted-foreground" />
            Contact developer
          </span>
          <span className="text-xs text-muted-foreground">{DEVELOPER_EMAIL}</span>
        </a>
      </Card>

      <button
        onClick={signOut}
        className="w-full mt-2 flex items-center justify-center gap-2 rounded-2xl border border-border/60 px-4 py-3.5 text-sm text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
      >
        <LogOut className="size-4" /> Sign out
      </button>

      <p className="text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-8">
        LifeUpdate · v1.0
      </p>
    </AppShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3 px-1">{title}</h2>
      <div className="rounded-2xl bg-card border border-border/60 overflow-hidden divide-y divide-border/60">
        {children}
      </div>
    </section>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
        <span>{icon}</span>
        {label}
      </div>
      {children}
    </div>
  );
}
