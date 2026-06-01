-- Workouts table for full workout logging
CREATE TABLE public.workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workout_type TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 0,
  calories_burned INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
GRANT ALL ON public.workouts TO service_role;

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workouts_all_own" ON public.workouts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX workouts_user_date_idx ON public.workouts (user_id, log_date DESC);

-- Add optional sleep bedtime/waketime to health_logs (kept nullable for backward compat)
ALTER TABLE public.health_logs
  ADD COLUMN IF NOT EXISTS bedtime TIME,
  ADD COLUMN IF NOT EXISTS wake_time TIME;
