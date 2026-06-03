ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON public.tasks(goal_id);