-- Applied live with apply_migration; this file is the record.
-- Order of goods in shop lists: 0 own in stock with photo, 1 partner goods (on order, with price and photo),
-- 2 own in stock without photo, 3 own "on order, ask the price". ask_price = the last kind (kept out of «All goods»).
alter table public.tyres add column if not exists list_rank smallint generated always as (
  case when on_order and supplier_offer_id is null then 3
       when supplier_offer_id is not null then 1
       when image_url is not null and image_url <> '' then 0
       else 2 end) stored;
alter table public.tyres add column if not exists ask_price boolean generated always as (coalesce(on_order, false) and supplier_offer_id is null) stored;
grant select (list_rank, ask_price) on public.tyres to anon, authenticated;
