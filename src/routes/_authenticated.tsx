import { createFileRoute, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CommandPaletteProvider } from "@/components/command-palette";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const { data: profile } = useQuery({
    queryKey: ["profile_onboarding"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("onboarding_completed").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile && profile.onboarding_completed === false && pathname !== "/onboarding") {
      navigate({ to: "/onboarding" });
    }
  }, [profile, pathname, navigate]);

  return (
    <CommandPaletteProvider>
      <Outlet />
    </CommandPaletteProvider>
  );
}
