import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { chatAssistant, clearAssistant } from "@/lib/assistant.functions";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Msg = { id: string; role: string; content: string };

export const Route = createFileRoute("/_authenticated/assistant")({ component: Assistant });

const PROMPTS = [
  "Help me plan my day.",
  "I'm overwhelmed — where do I start?",
  "Review my habits and suggest one to focus on.",
  "Reflect with me on the past week.",
];

function Assistant() {
  const qc = useQueryClient();
  const chat = useServerFn(chatAssistant);
  const clear = useServerFn(clearAssistant);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: msgs = [] } = useQuery({
    queryKey: ["ai_messages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_messages").select("id,role,content").order("created_at");
      if (error) throw error;
      return data as Msg[];
    },
  });

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [msgs.length]);

  const send = useMutation({
    mutationFn: async (message: string) => chat({ data: { message } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_messages"] }),
    onError: (e: Error) => toast.error(safeErrorMessage(e)),
  });

  const reset = useMutation({
    mutationFn: async () => clear({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_messages"] }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    if (!t || send.isPending) return;
    setInput("");
    send.mutate(t);
  };

  return (
    <AppShell
      title="Assistant"
      subtitle="Your quiet coach"
      action={
        msgs.length > 0 ? (
          <button onClick={() => reset.mutate()} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border/60 tap-scale">
            <RefreshCw className="size-3" /> New chat
          </button>
        ) : null
      }
    >
      <div ref={scrollRef} className="space-y-3 mb-6 min-h-[40vh] max-h-[55vh] overflow-y-auto">
        {msgs.length === 0 && (
          <div className="rounded-2xl bg-card border border-border/60 p-6 text-center">
            <div className="size-10 rounded-full bg-accent/15 text-accent grid place-items-center mx-auto mb-3"><Sparkles className="size-5" /></div>
            <p className="font-display text-2xl">How can I help today?</p>
            <p className="text-sm text-muted-foreground mt-1">I can see your tasks, habits and recent journal.</p>
            <div className="mt-5 grid gap-2">
              {PROMPTS.map(p => (
                <button key={p} onClick={() => send.mutate(p)} className="text-left text-sm rounded-xl bg-muted/60 hover:bg-muted px-4 py-3 transition-colors">{p}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map(m => (
          <div key={m.id} className={cn("flex fade-in-up", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap", m.role === "user" ? "bg-foreground text-background" : "bg-card border border-border/60")}>
              {m.content}
            </div>
          </div>
        ))}
        {send.isPending && (
          <div className="flex justify-start fade-in">
            <div className="bg-card border border-border/60 rounded-2xl px-4 py-3 inline-flex items-center gap-1.5">
              <Dot /><Dot delay={0.15} /><Dot delay={0.3} />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="sticky bottom-24 md:bottom-6 flex items-center gap-2 rounded-2xl bg-card border border-border/60 px-3 py-2 shadow-lift">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask anything…"
          className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground py-1"
        />
        <button type="submit" disabled={!input.trim() || send.isPending} className="grid place-items-center size-9 rounded-xl bg-foreground text-background disabled:opacity-40 tap-scale">
          <Send className="size-4" />
        </button>
      </form>
    </AppShell>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return <span className="size-2 rounded-full bg-muted-foreground/60 animate-breathe" style={{ animationDelay: `${delay}s` }} />;
}
