-- Supabase SQL Editor에서 실행하세요
--
-- materials.mpn = 기본 MPN
-- material_mpns = 대체 MPN만 저장
-- (기존 mpn/mpn2 컬럼 구조 또는 이전 material_mpns 마이그레이션 이후 모두 대응)

drop view if exists public.semi_product_bom_detail;

-- materials.mpn 복구 (이전 마이그레이션으로 삭제된 경우)
alter table public.materials add column if not exists mpn text default '';

-- material_mpns 테이블 생성 (없을 때)
create table if not exists public.material_mpns (
  id uuid primary key default gen_random_uuid(),
  material_id text not null references public.materials(id) on delete cascade,
  mpn text not null default '',
  sort_order smallint not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint material_mpns_mpn_not_blank_check check (length(trim(mpn)) > 0)
);

-- 이전 스키마(is_primary)에서 materials.mpn으로 기본값 복원
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'material_mpns'
      and column_name = 'is_primary'
  ) then
    update public.materials m
    set mpn = primary_row.mpn
    from (
      select distinct on (material_id)
        material_id,
        mpn
      from public.material_mpns
      where is_primary
      order by material_id, sort_order, created_at
    ) as primary_row
    where m.id = primary_row.material_id
      and trim(coalesce(m.mpn, '')) = '';

    delete from public.material_mpns where is_primary;

    drop index if exists public.material_mpns_one_primary_per_material_idx;
    alter table public.material_mpns drop column if exists is_primary;
  end if;
end $$;

-- 아직 materials에 mpn2 컬럼이 남아 있으면 대체 MPN으로 이전
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'materials'
      and column_name = 'mpn2'
  ) then
    insert into public.material_mpns (material_id, mpn, sort_order)
    select id, trim(mpn2), 1
    from public.materials
    where trim(coalesce(mpn2, '')) <> ''
    on conflict (material_id, mpn) do nothing;
  end if;
end $$;

-- materials.mpn이 비어 있고 대체 테이블에만 값이 있으면 첫 번째를 기본으로 승격
update public.materials m
set mpn = alt.mpn
from (
  select distinct on (material_id)
    material_id,
    mpn
  from public.material_mpns
  order by material_id, sort_order, created_at
) as alt
where m.id = alt.material_id
  and trim(coalesce(m.mpn, '')) = '';

-- 기본 MPN과 동일한 대체 MPN 제거
delete from public.material_mpns mm
using public.materials m
where mm.material_id = m.id
  and trim(mm.mpn) = trim(coalesce(m.mpn, ''));

comment on table public.material_mpns is '자재 대체 MPN — materials.mpn 외 추가 제조사 품번';
comment on column public.material_mpns.material_id is '자재 FK (materials.id)';
comment on column public.material_mpns.mpn is '대체 제조사 품번';

create unique index if not exists material_mpns_material_mpn_unique_idx
  on public.material_mpns (material_id, mpn);

create index if not exists material_mpns_material_id_idx
  on public.material_mpns (material_id);

create index if not exists material_mpns_mpn_idx
  on public.material_mpns (mpn);

alter table public.material_mpns enable row level security;

drop policy if exists "material_mpns public read" on public.material_mpns;
create policy "material_mpns public read"
  on public.material_mpns for select using (true);

drop policy if exists "material_mpns public insert" on public.material_mpns;
create policy "material_mpns public insert"
  on public.material_mpns for insert with check (true);

drop policy if exists "material_mpns public update" on public.material_mpns;
create policy "material_mpns public update"
  on public.material_mpns for update using (true) with check (true);

drop policy if exists "material_mpns public delete" on public.material_mpns;
create policy "material_mpns public delete"
  on public.material_mpns for delete using (true);

drop index if exists public.materials_mpn_idx;
create index if not exists materials_mpn_idx on public.materials (mpn);

alter table public.materials drop column if exists mpn2;

drop index if exists public.materials_spn_idx;
alter table public.materials drop column if exists spn;
alter table public.materials drop column if exists spn2;

comment on column public.materials.mpn is '기본 제조사 품번 (MPN)';

create or replace function public.normalize_materials_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_material_code();
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.customer := coalesce(trim(new.customer), '');
  new.material_name := coalesce(trim(new.material_name), '');
  new.specification := coalesce(trim(new.specification), '');
  new.type := coalesce(trim(new.type), '');
  new.cpn := coalesce(trim(new.cpn), '');
  new.mpn := coalesce(trim(new.mpn), '');
  new.supplier := coalesce(trim(new.supplier), '');
  new.supply_type := coalesce(trim(new.supply_type), '');
  new.moq := coalesce(new.moq, 0);
  new.unit_price := coalesce(new.unit_price, 0);
  return new;
end;
$$;

create view public.semi_product_bom_detail as
select
  bom.product_id,
  product.id as product_code,
  product.product_name,
  product.product_kind,
  bom.material_id,
  mat.id as material_code,
  mat.material_name,
  mat.cpn,
  mat.mpn,
  mat.type,
  bom.quantity_per,
  bom.ref_designator,
  bom.note
from public.semi_product_bom_items bom
join public.products product on product.id = bom.product_id
join public.materials mat on mat.id = bom.material_id
order by bom.product_id, mat.material_name, bom.ref_designator;

comment on view public.semi_product_bom_detail is '반제품 BOM 상세 (자재명·CPN·기본 MPN 포함)';
