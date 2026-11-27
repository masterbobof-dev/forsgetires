-- Applied live with apply_migration; this file is the record (stage 5).
-- private.title_with_number(name, sku): adds the part number to a partner product's name when it is not in it
-- («Свічка запалювання (вир-во NGK)» ×52 → «… BKR6EQUA»). Used by private.supplier_offers_apply (update and insert);
-- the 21 369 existing partner names were updated in batches. Identical product titles: thousands → 5 groups.
create or replace function private.title_with_number(p_name text, p_sku text) returns text
language sql immutable set search_path = 'public' as $$
  select case
    when p_sku is null or length(regexp_replace(p_sku, '[^0-9A-Za-zА-Яа-яІіЇїЄєҐґ]', '', 'g')) < 3 then p_name
    when position(upper(regexp_replace(p_sku, '[^0-9A-Za-zА-Яа-яІіЇїЄєҐґ]', '', 'g')) in upper(regexp_replace(coalesce(p_name, ''), '[^0-9A-Za-zА-Яа-яІіЇїЄєҐґ]', '', 'g'))) > 0 then p_name
    else btrim(coalesce(p_name, '')) || ' ' || btrim(p_sku)
  end
$$;
