
CREATE OR REPLACE FUNCTION public.seed_finance_defaults()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  has_any boolean;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  SELECT EXISTS(SELECT 1 FROM public.finance_categories WHERE user_id = uid) INTO has_any;
  IF has_any THEN RETURN; END IF;

  INSERT INTO public.finance_categories (user_id, name, kind, icon, color, sort_order, is_default) VALUES
    (uid,'Salary','income','briefcase','sage',1,true),
    (uid,'Freelance','income','laptop','sand',2,true),
    (uid,'Business','income','store','clay',3,true),
    (uid,'Dividends','income','trending-up','sage',4,true),
    (uid,'Other income','income','circle','sand',5,true),
    (uid,'Food','expense','utensils','clay',1,true),
    (uid,'Travel','expense','plane','sage',2,true),
    (uid,'Shopping','expense','shopping-bag','sand',3,true),
    (uid,'Rent','expense','home','clay',4,true),
    (uid,'Bills','expense','file-text','sage',5,true),
    (uid,'Entertainment','expense','music','sand',6,true),
    (uid,'Education','expense','book','clay',7,true),
    (uid,'Health','expense','heart','sage',8,true),
    (uid,'Family','expense','users','sand',9,true),
    (uid,'Other','expense','circle','clay',10,true);
END;
$$;

-- Drop the old parametrized version and lock down execute privileges
DROP FUNCTION IF EXISTS public.seed_finance_defaults(uuid);
REVOKE ALL ON FUNCTION public.seed_finance_defaults() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_finance_defaults() TO authenticated;
