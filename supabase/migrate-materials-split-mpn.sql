-- Supabase SQL Editor에서 실행하세요 (선택)
-- materials.mpn 한 칸에 공백으로 여러 MPN이 붙어 있는 경우 정리
--
-- 예) 'CC0402KRX7R7BB104     0402B104K160CT'
--   → mpn = 'CC0402KRX7R7BB104'
--   → material_mpns 에 '0402B104K160CT' 추가

with messy as (
  select
    id,
    trim(mpn) as raw_mpn,
    regexp_split_to_array(trim(mpn), '\s+') as tokens
  from public.materials
  where mpn ~ '\s{2,}' or mpn ~ '\s\S+\s'
),
first_token as (
  select id, tokens[1] as primary_mpn
  from messy
  where array_length(tokens, 1) > 1
),
extra_tokens as (
  select
    messy.id,
    trim(token) as extra_mpn
  from messy
  cross join lateral unnest(messy.tokens[2:array_length(messy.tokens, 1)]) as token
  where trim(token) <> ''
)
update public.materials as materials
set mpn = first_token.primary_mpn
from first_token
where materials.id = first_token.id
  and materials.mpn is distinct from first_token.primary_mpn;

insert into public.material_mpns (material_id, mpn, sort_order)
select
  extra.id,
  extra.extra_mpn,
  coalesce((
    select max(sort_order) from public.material_mpns existing where existing.material_id = extra.id
  ), 0) + row_number() over (partition by extra.id order by extra.extra_mpn)
from extra_tokens extra
where not exists (
  select 1
  from public.material_mpns existing
  where existing.material_id = extra.id
    and lower(trim(existing.mpn)) = lower(extra.extra_mpn)
)
on conflict do nothing;
