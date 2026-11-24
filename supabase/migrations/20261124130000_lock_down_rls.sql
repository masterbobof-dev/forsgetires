-- =====================================================================
-- Безпека: змінювати дані можуть лише співробітники (admin / manager /
-- service staff email з таблиці settings). Відвідувачі сайту можуть
-- лише читати каталог та створювати замовлення / записи.
-- =====================================================================

-- Чи є поточний користувач співробітником
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(auth.jwt() ->> 'email', '') <> '' AND EXISTS (
    SELECT 1 FROM public.settings
    WHERE key IN ('admin_email', 'manager_email', 'service_staff_email')
      AND lower(trim(value)) = lower(auth.jwt() ->> 'email')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(auth.jwt() ->> 'email', '') <> '' AND EXISTS (
    SELECT 1 FROM public.settings
    WHERE key = 'admin_email'
      AND lower(trim(value)) = lower(auth.jwt() ->> 'email')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM public;
REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Старі (надто широкі) політики не видаляємо, а вимикаємо: USING/WITH CHECK = false.
-- (Політики storage.objects не можна перейменувати — вони лише вимикаються.)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd FROM pg_policies
    WHERE policyname NOT LIKE 'old\_off\_%'
      AND policyname NOT IN ('galery_read','galery_insert','galery_update','galery_delete')
      AND ((schemaname = 'public' AND tablename IN
            ('tyres','settings','tyre_orders','bookings','articles','gallery',
             'pricing','suppliers','analytics_events','product_categories'))
       OR (schemaname = 'storage' AND tablename = 'objects'
           AND (coalesce(qual,'') LIKE '%galery%' OR coalesce(with_check,'') LIKE '%galery%')))
  LOOP
    IF r.cmd = 'INSERT' THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (false)', r.policyname, r.schemaname, r.tablename);
    ELSIF r.cmd IN ('SELECT','DELETE') THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (false)', r.policyname, r.schemaname, r.tablename);
    ELSE
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (false) WITH CHECK (false)', r.policyname, r.schemaname, r.tablename);
    END IF;
    IF r.schemaname = 'public' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I RENAME TO %I', r.policyname, r.tablename, left('old_off_' || r.policyname, 63));
    END IF;
  END LOOP;
END $$;

-- Каталог: читати можуть усі, змінювати — співробітники
CREATE POLICY "read_all"    ON public.tyres              FOR SELECT USING (true);
CREATE POLICY "staff_write" ON public.tyres              FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "read_all"    ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "staff_write" ON public.product_categories FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "read_all"    ON public.articles           FOR SELECT USING (true);
CREATE POLICY "staff_write" ON public.articles           FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "read_all"    ON public.gallery            FOR SELECT USING (true);
CREATE POLICY "staff_write" ON public.gallery            FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "read_all"    ON public.pricing            FOR SELECT USING (true);
CREATE POLICY "staff_write" ON public.pricing            FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Постачальники — лише співробітники
CREATE POLICY "staff_all" ON public.suppliers FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Налаштування: публічні ключі бачать усі; email-и, PIN-и та API-ключі — лише співробітники
CREATE POLICY "public_read" ON public.settings FOR SELECT USING (
  key LIKE 'contact\_%' OR key LIKE 'seo\_%' OR key LIKE 'hero\_%' OR key LIKE 'prices\_%'
  OR key IN ('promo_data', 'enable_stock_quantity', 'nova_poshta_key', 'agro_featured_ids', 'hide_tire_service')
);
CREATE POLICY "staff_read"  ON public.settings FOR SELECT TO authenticated USING (public.is_staff());
-- Лише адміністратор може змінювати налаштування (зокрема список співробітників)
CREATE POLICY "admin_write" ON public.settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
-- Менеджер може змінювати не-службові налаштування (SEO, AI-провайдер, акції...)
CREATE POLICY "staff_write_safe" ON public.settings FOR ALL TO authenticated
  USING (public.is_staff() AND key NOT IN ('admin_email','manager_email','service_staff_email','admin_pin','tyre_admin_pin'))
  WITH CHECK (public.is_staff() AND key NOT IN ('admin_email','manager_email','service_staff_email','admin_pin','tyre_admin_pin'));

-- Замовлення: покупці лише створюють, співробітники бачать і керують
CREATE POLICY "anyone_insert" ON public.tyre_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_all"     ON public.tyre_orders FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Записи на сервіс (старий сайт): створювати та бачити зайнятий час можна, змінювати — лише співробітники
CREATE POLICY "anyone_insert" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone_read"   ON public.bookings FOR SELECT USING (true);
CREATE POLICY "staff_all"     ON public.bookings FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Аналітика: відвідувачі пишуть події, читають лише співробітники
CREATE POLICY "anyone_insert" ON public.analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_read"    ON public.analytics_events FOR SELECT TO authenticated USING (public.is_staff());

-- Фото товарів (bucket galery): дивитися можуть усі, завантажувати/видаляти — співробітники
CREATE POLICY "galery_read"   ON storage.objects FOR SELECT USING (bucket_id = 'galery');
CREATE POLICY "galery_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'galery' AND public.is_staff());
CREATE POLICY "galery_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'galery' AND public.is_staff());
CREATE POLICY "galery_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'galery' AND public.is_staff());

-- Функція створення менеджера: лише для адміністратора і не для акаунта адміністратора
CREATE OR REPLACE FUNCTION public.set_manager_credentials(m_email text, m_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $function$
DECLARE
  m_id uuid;
  hashed_password text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the administrator can set manager credentials' USING ERRCODE = '42501';
  END IF;
  IF lower(trim(m_email)) IN (SELECT lower(trim(value)) FROM public.settings WHERE key = 'admin_email') THEN
    RAISE EXCEPTION 'Manager email must differ from the administrator email' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(m_password, '')) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  hashed_password := extensions.crypt(m_password, extensions.gen_salt('bf', 10));
  SELECT id INTO m_id FROM auth.users WHERE email = m_email;

  IF m_id IS NOT NULL THEN
    UPDATE auth.users SET
      encrypted_password = hashed_password,
      email_confirmed_at = NOW(),
      updated_at = NOW(),
      confirmation_token = COALESCE(confirmation_token, ''),
      email_change = COALESCE(email_change, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      phone_change_token = COALESCE(phone_change_token, ''),
      reauthentication_token = COALESCE(reauthentication_token, '')
    WHERE id = m_id;
  ELSE
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, phone, phone_confirmed_at,
      confirmation_token, email_change, email_change_token_new, recovery_token,
      email_change_token_current, phone_change_token, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', extensions.gen_random_uuid(), 'authenticated', 'authenticated',
      m_email, hashed_password, NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), NULL, NULL,
      '', '', '', '', '', '', ''
    );
  END IF;

  INSERT INTO public.settings (key, value) VALUES ('manager_email', m_email)
  ON CONFLICT (key) DO UPDATE SET value = m_email;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_manager_credentials(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_manager_credentials(text, text) TO authenticated;
