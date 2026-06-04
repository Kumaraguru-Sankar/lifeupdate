ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_type_check CHECK (workout_type IN ('walking','running','gym','cycling','yoga','swimming','custom')),
  ADD CONSTRAINT workouts_duration_range CHECK (duration_min >= 0 AND duration_min <= 1440),
  ADD CONSTRAINT workouts_calories_range CHECK (calories_burned >= 0 AND calories_burned <= 30000),
  ADD CONSTRAINT workouts_notes_len CHECK (notes IS NULL OR length(notes) <= 2000);