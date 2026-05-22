
-- weight logs
CREATE TABLE public.weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric NOT NULL CHECK (weight_kg > 0 AND weight_kg < 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY weight_all_own ON public.weight_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- step goals (one row per user)
CREATE TABLE public.step_goals (
  user_id uuid PRIMARY KEY,
  daily_target integer NOT NULL DEFAULT 8000 CHECK (daily_target >= 0 AND daily_target <= 200000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.step_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY step_goals_all_own ON public.step_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- nutrition logs
CREATE TABLE public.nutrition_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  name text NOT NULL CHECK (length(name) <= 200),
  calories integer NOT NULL DEFAULT 0 CHECK (calories >= 0 AND calories <= 20000),
  protein_g numeric NOT NULL DEFAULT 0 CHECK (protein_g >= 0 AND protein_g <= 2000),
  carbs_g numeric NOT NULL DEFAULT 0 CHECK (carbs_g >= 0 AND carbs_g <= 2000),
  fat_g numeric NOT NULL DEFAULT 0 CHECK (fat_g >= 0 AND fat_g <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrition_all_own ON public.nutrition_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_nutrition_user_date ON public.nutrition_logs(user_id, log_date);

-- expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  spent_on date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL CHECK (category IN ('food','travel','shopping','bills','entertainment','health','education','misc')),
  amount numeric NOT NULL CHECK (amount >= 0 AND amount <= 100000000),
  note text CHECK (note IS NULL OR length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenses_all_own ON public.expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_expenses_user_date ON public.expenses(user_id, spent_on);

-- incomes
CREATE TABLE public.incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  received_on date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL CHECK (source IN ('salary','freelance','passive','other')),
  amount numeric NOT NULL CHECK (amount >= 0 AND amount <= 100000000),
  note text CHECK (note IS NULL OR length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY incomes_all_own ON public.incomes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_incomes_user_date ON public.incomes(user_id, received_on);

-- subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) <= 200),
  amount numeric NOT NULL CHECK (amount >= 0 AND amount <= 100000000),
  cycle text NOT NULL DEFAULT 'monthly' CHECK (cycle IN ('monthly','yearly','weekly')),
  next_renewal date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_all_own ON public.subscriptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- investments
CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) <= 200),
  asset_type text NOT NULL CHECK (asset_type IN ('stock','mutual_fund','crypto','sip','savings','other')),
  invested numeric NOT NULL CHECK (invested >= 0 AND invested <= 1000000000),
  current_value numeric NOT NULL CHECK (current_value >= 0 AND current_value <= 1000000000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY investments_all_own ON public.investments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- profile additions for BMI / calorie calculators
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm numeric CHECK (height_cm IS NULL OR (height_cm > 0 AND height_cm < 400)),
  ADD COLUMN IF NOT EXISTS age integer CHECK (age IS NULL OR (age >= 0 AND age <= 150)),
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IS NULL OR gender IN ('male','female','other')),
  ADD COLUMN IF NOT EXISTS activity_level text CHECK (activity_level IS NULL OR activity_level IN ('sedentary','light','moderate','active','very_active'));
