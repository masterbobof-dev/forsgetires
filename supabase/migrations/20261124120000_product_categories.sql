-- =====================================================================
-- Категорії товарів для інтернет-магазину
-- Як застосувати: supabase.com -> ваш проєкт -> SQL Editor -> New query ->
-- вставте весь цей файл і натисніть Run. Скрипт можна запускати повторно.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.product_categories (
  id           bigserial PRIMARY KEY,
  name         text NOT NULL,
  slug         text NOT NULL UNIQUE,
  parent_id    bigint REFERENCES public.product_categories(id) ON DELETE CASCADE,
  icon         text DEFAULT 'package',
  description  text,
  sort_order   int  NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  -- 'tyre' = показувати фільтри шин (ширина/висота/радіус/сезон), 'generic' = звичайний товар
  kind         text NOT NULL DEFAULT 'generic' CHECK (kind IN ('tyre', 'generic')),
  -- Для підкатегорій шин: який старий тип авто (vehicle_type) їм відповідає
  vehicle_type text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_categories_parent_idx ON public.product_categories(parent_id);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_public_read" ON public.product_categories;
CREATE POLICY "categories_public_read" ON public.product_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "categories_auth_write" ON public.product_categories;
-- Змінювати категорії можуть лише адміністратор та менеджер (email з таблиці settings)
CREATE POLICY "categories_auth_write" ON public.product_categories
  FOR ALL TO authenticated
  USING (lower(auth.jwt() ->> 'email') IN (
    SELECT lower(trim(value)) FROM public.settings WHERE key IN ('admin_email', 'manager_email')))
  WITH CHECK (lower(auth.jwt() ->> 'email') IN (
    SELECT lower(trim(value)) FROM public.settings WHERE key IN ('admin_email', 'manager_email')));

-- Товари отримують посилання на категорію та довільні характеристики
ALTER TABLE public.tyres ADD COLUMN IF NOT EXISTS category_id bigint
  REFERENCES public.product_categories(id) ON DELETE SET NULL;
ALTER TABLE public.tyres ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS tyres_category_idx ON public.tyres(category_id);

-- ---------------------------------------------------------------------
-- Стартові категорії (не дублюються при повторному запуску)
-- ---------------------------------------------------------------------
INSERT INTO public.product_categories (name, slug, icon, sort_order, kind) VALUES
  ('Шини',            'shyny',        'circle-dot', 10, 'tyre'),
  ('Диски',           'dysky',        'disc',       20, 'generic'),
  ('Акумулятори',     'akumulyatory', 'battery',    30, 'generic'),
  ('Масла та рідини', 'masla',        'droplet',    40, 'generic'),
  ('Автотовари',      'avtotovary',   'package',    50, 'generic')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.product_categories (name, slug, icon, sort_order, kind, vehicle_type, parent_id)
SELECT v.name, v.slug, v.icon, v.sort_order, 'tyre', v.vehicle_type,
       (SELECT id FROM public.product_categories WHERE slug = 'shyny')
FROM (VALUES
  ('Легкові',        'shyny-legkovi', 'car',      1, 'car'),
  ('SUV / 4x4',      'shyny-suv',     'mountain', 2, 'suv'),
  ('Буси (C)',       'shyny-busy',    'truck',    3, 'cargo'),
  ('Вантажні (TIR)', 'shyny-tir',     'truck',    4, 'truck'),
  ('Агро / Спец',    'shyny-agro',    'tractor',  5, 'agro')
) AS v(name, slug, icon, sort_order, vehicle_type)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------
-- Розкладаємо вже існуючі шини по підкатегоріях (тільки ті, що ще без категорії)
-- ---------------------------------------------------------------------
UPDATE public.tyres t SET category_id = c.id
FROM public.product_categories c
WHERE t.category_id IS NULL
  AND c.slug = 'shyny-busy'
  AND (t.vehicle_type = 'cargo'
       OR ((t.vehicle_type IS NULL OR t.vehicle_type = 'car') AND t.radius ILIKE '%C'));

UPDATE public.tyres t SET category_id = c.id
FROM public.product_categories c
WHERE t.category_id IS NULL
  AND c.parent_id IS NOT NULL
  AND c.vehicle_type = COALESCE(t.vehicle_type, 'car');
