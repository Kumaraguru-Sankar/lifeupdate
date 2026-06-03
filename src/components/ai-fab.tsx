import { Link, useLocation } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function AIFab() {
  const { pathname } = useLocation();
  // Don't render when already on assistant page
  if (pathname === "/assistant") return null;
  return (
    <Link
      to="/assistant"
      aria-label="Open AI Assistant"
      title="Ask the AI"
      className="fixed z-40 right-4 bg-[var(--nb-pink)] text-white grid place-items-center size-14 rounded-2xl border-[3px] border-[var(--nb-ink)] nb-shadow-lg tap-scale animate-breathe"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
    >
      <Sparkles className="size-6" strokeWidth={2.8} />
    </Link>
  );
}
