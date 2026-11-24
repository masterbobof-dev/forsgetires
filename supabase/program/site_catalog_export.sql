-- Created in the PROGRAM project (zuhanlspejgizjbwbnda). Read-only export for the website.
-- Protected by a token (only its sha256 is stored here). No purchase/wholesale/min prices.
create or replace function public.site_catalog_export(p_token text, p_since timestamptz default '1970-01-01', p_after_id uuid default '00000000-0000-0000-0000-000000000000', p_limit int default 1000)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare v_rows jsonb; v_cats jsonb;
begin
  if p_token is null or encode(extensions.digest(p_token, 'sha256'), 'hex') <> '72b8bf09277cb40c65111de3437df7f30f4958f79dd48475448158fd6b6b0b20' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(r order by r.updated_at, r.id), '[]'::jsonb) into v_rows from (
    select p.id, p.updated_at, p.sku, p.name, p.barcode, p.oem_number, p.unit, p.retail_price, p.qty_on_hand,
           (p.is_active and p.deleted_at is null and coalesce(p.is_service, false) = false) as active,
           p.category_id, b.name as brand, p.photo_url, p.specs,
           (select coalesce(jsonb_agg(ph.url order by ph.sort_order), '[]'::jsonb) from product_photos ph where ph.product_id = p.id) as photos
    from products p left join brands b on b.id = p.brand_id
    where (p.updated_at, p.id) > (p_since, p_after_id)
    order by p.updated_at, p.id limit least(greatest(p_limit, 1), 2000)
  ) r;
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'parent_id', c.parent_id, 'sort_order', c.sort_order)), '[]'::jsonb)
    into v_cats from categories c where c.deleted_at is null;
  return jsonb_build_object('products', v_rows, 'categories', v_cats);
end $$;
revoke all on function public.site_catalog_export(text, timestamptz, uuid, int) from public;
grant execute on function public.site_catalog_export(text, timestamptz, uuid, int) to anon;
