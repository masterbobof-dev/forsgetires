-- Brake fluid is recognised by its name: in the program part of it lies in "Гальмівна система" (41) together with pads and cylinders,
-- so "З цим купують" offered other brake fluids. Now: brake fluid → brake parts; brake parts → brake fluid.
-- Applied to the site database on 2026-11-24.
create or replace function public.product_kind(t text, cat bigint) returns text
language sql immutable as $$
  select case
    when cat in (41, 111) and t ~* '(тормозн\w*\s+жидк|жидк\w*\s+тормоз|гальмівн\w*\s+рідин|рідин\w*\s+гальм|brake\s*fluid|(^|\s)dot[ -]?[345])' then 'brake_fluid'
    when cat = 81 and t ~* '(gl-?\d|трансм|getriebe|atf|dsg|dct|тад|tad|cvt|гидрав|гідрав)' then 'oil_trans'
    when cat = 81 and t ~* '(промыв|промив|flush)' then 'flush'
    when cat = 81 and t ~* '(2t|2т)' then 'oil_2t'
    when cat = 81 and public.viscosity(t) is not null then 'oil_engine'
    when cat = 101 and t ~* 'масл' then 'filter_oil'
    when cat = 101 and t ~* '(возд|повітр)' then 'filter_air'
    when cat = 101 and t ~* 'салон' then 'filter_cabin'
    when cat = 101 and t ~* '(палив|топл)' then 'filter_fuel'
    else 'cat_' || coalesce(cat, 0)
  end;
$$;

-- product_related(): rules and the join are patched in place (the full function is in 20261125010000_oil_approvals.sql)
do $do$
declare d text := pg_get_functiondef('public.product_related(bigint)'::regprocedure); w text := pg_get_functiondef('public.title_words(text)'::regprocedure);
begin
  d := replace(d, $a$('cat_41','cat_111',4), ('cat_41','cat_18',3), ('cat_111','cat_41',5),$a$,
                  $b$('cat_41','brake_fluid',4), ('cat_41','cat_111',2), ('cat_111','cat_41',5), ('brake_fluid','cat_41',6),$b$);
  d := replace(d, $a$join tyres t on (case when r.target like 'cat\_%' then t.category_id = substr(r.target, 5)::bigint
                          else t.category_id in (81, 101) and product_kind(t.title, t.category_id) = r.target end)$a$,
                  $b$join tyres t on (case when r.target like 'cat\_%' then t.category_id = substr(r.target, 5)::bigint
                          else t.category_id in (81, 101, 41, 111) end) and product_kind(t.title, t.category_id) = r.target$b$);
  execute d;
  -- generic words must not decide which brake part is shown first
  if position('тормозная' in w) = 0 then
    w := replace(w, $a$'синій','синий',$a$, $b$'тормозная','тормозной','тормозные','тормозных','тормоза','гальмівна','гальмівний','гальмівні','гальмівних','жидкость','рідина','dot','синій','синий',$b$);
    execute w;
  end if;
end $do$;
