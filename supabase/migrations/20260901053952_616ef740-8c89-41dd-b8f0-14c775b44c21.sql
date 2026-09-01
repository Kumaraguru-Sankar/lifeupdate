REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_finance_defaults() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_finance_defaults() TO authenticated;