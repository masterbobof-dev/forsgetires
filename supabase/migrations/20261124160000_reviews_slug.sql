-- Product reviews (moderated) + missing tyres.slug column used by the admin form. Applied 2026-11-24.
ALTER TABLE public.tyres ADD COLUMN IF NOT EXISTS slug text;

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id bigserial PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES public.tyres(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 80),
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text CHECK (body IS NULL OR char_length(body) <= 2000),
  approved boolean NOT NULL DEFAULT false,
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_reviews_product_idx ON public.product_reviews(product_id) WHERE approved;
CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_one_per_user ON public.product_reviews(product_id, user_id);
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_approved_or_own" ON public.product_reviews FOR SELECT USING (approved OR user_id = auth.uid() OR public.is_staff());
CREATE POLICY "customer_insert" ON public.product_reviews FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND approved = false AND admin_reply IS NULL);
CREATE POLICY "staff_manage" ON public.product_reviews FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
