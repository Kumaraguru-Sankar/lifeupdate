import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isUsernameValid, normalizeUsername, usernameToEmail } from "@/lib/username-auth";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUsernameValid(username)) {
      toast.error("Username must be 3–24 characters, letters/numbers/._-");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      const fakeEmail = usernameToEmail(username);
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: fakeEmail,
          password,
          options: {
            data: {
              display_name: normalizeUsername(username),
              username: normalizeUsername(username),
              recovery_email: email || null,
            },
          },
        });
        if (error) throw error;
        // Try immediate sign-in (works if email confirmation isn't required)
        const { error: signErr } = await supabase.auth.signInWithPassword({ email: fakeEmail, password });
        if (signErr) {
          toast.success("Account created. You can sign in now.");
          setMode("signin");
        } else {
          navigate({ to: "/" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      // Friendlier error
      if (/invalid login/i.test(msg)) toast.error("Wrong username or password");
      else if (/already registered/i.test(msg)) toast.error("Username already taken");
      else toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center px-5 relative overflow-hidden">
      {/* Floating ambient blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 size-[420px] rounded-full bg-grad-sky opacity-50 blur-3xl float" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-20 size-[460px] rounded-full bg-grad-peach opacity-50 blur-3xl float" style={{ animationDelay: "2s" }} />
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 size-[300px] rounded-full bg-grad-lilac opacity-30 blur-3xl float" style={{ animationDelay: "4s" }} />

      <div className="w-full max-w-sm relative">
        <Link to="/login" className="flex flex-col items-center gap-3 mb-8">
          <span className="size-14 rounded-2xl bg-grad-sky grid place-items-center shadow-pop">
            <Sparkles className="size-7 text-white drop-shadow" strokeWidth={2.4} />
          </span>
          <span className="font-display text-3xl">LifeOS</span>
        </Link>

        <div className="rounded-3xl bg-card/80 glass-strong border border-border/60 shadow-lift p-6 pop-in">
          <h1 className="font-display text-3xl text-center mb-1">
            {mode === "signin" ? "Welcome back" : "Hello, friend"}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {mode === "signin" ? "Continue your journey." : "Start your cozy daily ritual."}
          </p>

          <form onSubmit={submit} className="space-y-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full h-12 rounded-2xl bg-background/60 border border-border pl-9 pr-4 outline-none text-sm focus:border-accent focus:ring-4 focus:ring-accent/15 transition-all"
              />
            </div>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full h-12 rounded-2xl bg-background/60 border border-border px-4 outline-none text-sm focus:border-accent focus:ring-4 focus:ring-accent/15 transition-all"
            />
            {mode === "signup" && (
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Recovery email (optional)"
                className="w-full h-12 rounded-2xl bg-background/60 border border-border px-4 outline-none text-sm focus:border-accent focus:ring-4 focus:ring-accent/15 transition-all"
              />
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-2xl bg-grad-sky text-white text-sm font-semibold tracking-wide disabled:opacity-60 tap-scale shadow-pop"
            >
              {busy ? "…" : mode === "signin" ? "Sign in" : "Create my space"}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full mt-5 text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-5">
          No emails. No social logins. Just you & your habits.
        </p>
      </div>
    </div>
  );
}
