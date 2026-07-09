-- Supabase SQL Editor에서 실행하세요 (setup-products.sql 이후)
--
-- 자재코드 = id — INSERT 시 직접 입력 (자동 발급 없음)

create table if not exists public.materials (
  id text primary key,
  customer text default '',
  material_name text not null default '',
  specification text default '',
  type text default '',
  mpn text default '',
  supplier text default '',
  supply_type text default '',
  moq numeric default 0,
  unit_price numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint materials_id_not_blank_check check (length(trim(id)) > 0)
);

comment on table public.materials is '자재등록 마스터 — 자재코드=id (INSERT 시 직접 입력)';
comment on column public.materials.id is '자재코드 (INSERT 시 필수, 수정 불가)';
comment on column public.materials.customer is '고객사';
comment on column public.materials.material_name is '자재명';
comment on column public.materials.specification is '규격';
comment on column public.materials.type is '자재 구분 (SMD / DIP)';
comment on column public.materials.mpn is '기본 제조사 품번 (MPN)';
comment on column public.materials.supplier is '공급업체';
comment on column public.materials.supply_type is '도급/사급';
comment on column public.materials.moq is 'MOQ (최소주문량)';
comment on column public.materials.unit_price is '단가';

create index if not exists materials_customer_idx on public.materials (customer);
create index if not exists materials_material_name_idx on public.materials (material_name);
create index if not exists materials_mpn_idx on public.materials (mpn);
create index if not exists materials_supplier_idx on public.materials (supplier);

alter table public.materials enable row level security;

drop policy if exists "materials public read" on public.materials;
create policy "materials public read" on public.materials for select using (true);

drop policy if exists "materials public insert" on public.materials;
create policy "materials public insert" on public.materials for insert with check (true);

drop policy if exists "materials public update" on public.materials;
create policy "materials public update" on public.materials for update using (true) with check (true);

drop policy if exists "materials public delete" on public.materials;
create policy "materials public delete" on public.materials for delete using (true);

create or replace function public.touch_materials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.normalize_materials_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.id := coalesce(trim(new.id), '');
    if new.id = '' then
      raise exception 'materials.id 는 INSERT 시 필수입니다.';
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.customer := coalesce(trim(new.customer), '');
  new.material_name := coalesce(trim(new.material_name), '');
  new.specification := coalesce(trim(new.specification), '');
  new.type := coalesce(trim(new.type), '');
  new.mpn := coalesce(trim(new.mpn), '');
  new.supplier := coalesce(trim(new.supplier), '');
  new.supply_type := coalesce(trim(new.supply_type), '');
  new.moq := coalesce(new.moq, 0);
  new.unit_price := coalesce(new.unit_price, 0);
  return new;
end;
$$;

drop trigger if exists materials_normalize_row on public.materials;
create trigger materials_normalize_row
  before insert or update on public.materials
  for each row
  execute function public.normalize_materials_row();

drop trigger if exists materials_updated_at on public.materials;
create trigger materials_updated_at
  before update on public.materials
  for each row
  execute function public.touch_materials_updated_at();

-- 대체 MPN (material_mpns)
create table if not exists public.material_mpns (
  id uuid primary key default gen_random_uuid(),
  material_id text not null references public.materials(id) on delete cascade,
  mpn text not null default '',
  sort_order smallint not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint material_mpns_mpn_not_blank_check check (length(trim(mpn)) > 0)
);

comment on table public.material_mpns is '자재 대체 MPN — materials.mpn 외 추가 제조사 품번';

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
