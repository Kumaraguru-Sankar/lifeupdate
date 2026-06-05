
-- Accounts
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'bank',
  balance numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  color text NOT NULL DEFAULT 'sage',
  icon text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounts_type_check CHECK (type IN ('cash','bank','credit_card','wallet','investment','loan','savings')),
  CONSTRAINT accounts_name_len CHECK (char_length(name) BETWEEN 1 AND 80)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_all_own ON public.accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_accounts BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Finance categories
CREATE TABLE public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL,
  icon text NOT NULL DEFAULT 'circle',
  color text NOT NULL DEFAULT 'sage',
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fc_kind_check CHECK (kind IN ('income','expense')),
  CONSTRAINT fc_name_len CHECK (char_length(name) BETWEEN 1 AND 60)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categories TO authenticated;
GRANT ALL ON public.finance_categories TO service_role;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY fc_all_own ON public.finance_categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  amount numeric(14,2) NOT NULL,
  account_id uuid,
  to_account_id uuid,
  category_id uuid,
  goal_id uuid,
  note text,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  recurring boolean NOT NULL DEFAULT false,
  recurrence text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tx_type_check CHECK (type IN ('income','expense','transfer','investment')),
  CONSTRAINT tx_recurrence_check CHECK (recurrence IN ('none','daily','weekly','monthly','yearly')),
  CONSTRAINT tx_amount_check CHECK (amount >= 0 AND amount <= 100000000),
  CONSTRAINT tx_note_len CHECK (note IS NULL OR char_length(note) <= 500)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tx_all_own ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_transactions BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX tx_user_date_idx ON public.transactions(user_id, occurred_on DESC);

-- Budgets
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  month date NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id, month),
  CONSTRAINT budgets_amount_check CHECK (amount >= 0 AND amount <= 100000000)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY budgets_all_own ON public.budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_budgets BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Liabilities
CREATE TABLE public.liabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'loan',
  balance numeric(14,2) NOT NULL DEFAULT 0,
  interest_rate numeric(6,3),
  due_day integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT liab_type_check CHECK (type IN ('loan','credit_card','mortgage','other')),
  CONSTRAINT liab_name_len CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT liab_due_day CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 31))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liabilities TO authenticated;
GRANT ALL ON public.liabilities TO service_role;
ALTER TABLE public.liabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY liab_all_own ON public.liabilities FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_liab BEFORE UPDATE ON public.liabilities FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Extend goals with finance fields (nullable so existing rows stay valid)
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS target_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS current_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'other';
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_kind_check;
ALTER TABLE public.goals ADD CONSTRAINT goals_kind_check CHECK (kind IN ('finance','other'));

-- Seed default categories for a user (idempotent)
CREATE OR REPLACE FUNCTION public.seed_finance_defaults(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_any boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.finance_categories WHERE user_id = _user_id) INTO has_any;
  IF has_any THEN RETURN; END IF;

  INSERT INTO public.finance_categories (user_id, name, kind, icon, color, sort_order, is_default) VALUES
    (_user_id,'Salary','income','briefcase','sage',1,true),
    (_user_id,'Freelance','income','laptop','sand',2,true),
    (_user_id,'Business','income','store','clay',3,true),
    (_user_id,'Dividends','income','trending-up','sage',4,true),
    (_user_id,'Other income','income','circle','sand',5,true),
    (_user_id,'Food','expense','utensils','clay',1,true),
    (_user_id,'Travel','expense','plane','sage',2,true),
    (_user_id,'Shopping','expense','shopping-bag','sand',3,true),
    (_user_id,'Rent','expense','home','clay',4,true),
    (_user_id,'Bills','expense','file-text','sage',5,true),
    (_user_id,'Entertainment','expense','music','sand',6,true),
    (_user_id,'Education','expense','book','clay',7,true),
    (_user_id,'Health','expense','heart','sage',8,true),
    (_user_id,'Family','expense','users','sand',9,true),
    (_user_id,'Other','expense','circle','clay',10,true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_finance_defaults(uuid) TO authenticated;
