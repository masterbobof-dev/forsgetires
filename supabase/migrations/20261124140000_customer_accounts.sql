-- Customer accounts: profiles, orders linked to customers, legal settings readable by visitors.
-- (Already applied to the production database on 2026-11-24.)

ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS filter_preset text;
CREATE INDEX IF NOT EXISTS tyres_attributes_gin ON public.tyres USING gin (attributes);

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text, phone text, city text, warehouse text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_or_staff_read" ON public.customer_profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff());
CREATE POLICY "own_insert" ON public.customer_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own_update" ON public.customer_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.customer_profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.tyre_orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tyre_orders ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE public.tyre_orders ADD COLUMN IF NOT EXISTS tracking_number text;
CREATE INDEX IF NOT EXISTS tyre_orders_user_idx ON public.tyre_orders(user_id);
CREATE POLICY "customer_read_own" ON public.tyre_orders FOR SELECT TO authenticated USING (user_id = auth.uid());
ALTER POLICY "anyone_insert" ON public.tyre_orders WITH CHECK (user_id IS NULL OR user_id = auth.uid());

ALTER POLICY "public_read" ON public.settings USING (
  key LIKE 'contact\_%' OR key LIKE 'seo\_%' OR key LIKE 'hero\_%' OR key LIKE 'prices\_%' OR key LIKE 'legal\_%'
  OR key IN ('promo_data', 'enable_stock_quantity', 'nova_poshta_key', 'agro_featured_ids', 'hide_tire_service'));
