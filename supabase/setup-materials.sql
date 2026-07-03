-- Supabase SQL Editor에서 실행하세요 (setup-quotations.sql, setup-orders.sql 이후)

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  customer text default '',
  material_name text not null default '',
  specification text default '',
  process text default '',
  cpn text default '',
  mpn text default '',
  mpn2 text default '',
  spn text default '',
  spn2 text default '',
  supplier text default '',
  supply_type text default '',
  moq numeric default 0,
  unit_price numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.materials is '자재등록 마스터 (고객사+CPN 기준 품목)';
comment on column public.materials.customer is '고객사';
comment on column public.materials.material_name is '자재명';
comment on column public.materials.specification is '규격';
comment on column public.materials.process is '공정 (SMD / DIP)';
comment on column public.materials.cpn is '고객 품번 (CPN)';
comment on column public.materials.mpn is '제조사 품번 (MPN)';
comment on column public.materials.mpn2 is '제조사 품번 2 (MPN2)';
comment on column public.materials.spn is '공급사 품번 (SPN)';
comment on column public.materials.spn2 is '공급사 품번 2 (SPN2)';
comment on column public.materials.supplier is '공급업체';
comment on column public.materials.supply_type is '도급/사급';
comment on column public.materials.moq is 'MOQ (최소주문량)';
comment on column public.materials.unit_price is '단가';

create index if not exists materials_customer_idx on public.materials (customer);
create index if not exists materials_material_name_idx on public.materials (material_name);
create index if not exists materials_cpn_idx on public.materials (cpn);
create index if not exists materials_mpn_idx on public.materials (mpn);
create index if not exists materials_spn_idx on public.materials (spn);
create index if not exists materials_supplier_idx on public.materials (supplier);

-- 고객사 + CPN 조합 유일 (CPN이 있을 때만 — GAS 자재등록과 동일)
create unique index if not exists materials_customer_cpn_unique_idx
  on public.materials (customer, cpn)
  where cpn <> '';

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

-- CSV/엑셀 import 시 빈 칸이 NULL로 들어와도 빈 문자열·0으로 정규화
create or replace function public.normalize_materials_row()
returns trigger
language plpgsql
as $$
begin
  new.customer := coalesce(trim(new.customer), '');
  new.material_name := coalesce(trim(new.material_name), '');
  new.specification := coalesce(trim(new.specification), '');
  new.process := coalesce(trim(new.process), '');
  new.cpn := coalesce(trim(new.cpn), '');
  new.mpn := coalesce(trim(new.mpn), '');
  new.mpn2 := coalesce(trim(new.mpn2), '');
  new.spn := coalesce(trim(new.spn), '');
  new.spn2 := coalesce(trim(new.spn2), '');
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

-- 이미 materials 테이블을 만든 뒤 import 오류(23502)가 나면 아래를 한 번 실행하세요.
-- alter table public.materials alter column customer drop not null;
-- alter table public.materials alter column specification drop not null;
-- alter table public.materials alter column process drop not null;
-- alter table public.materials drop constraint if exists materials_process_check;
-- alter table public.materials alter column cpn drop not null;
-- alter table public.materials alter column mpn drop not null;
-- alter table public.materials alter column mpn2 drop not null;
-- alter table public.materials alter column spn drop not null;
-- alter table public.materials alter column spn2 drop not null;
-- alter table public.materials alter column supplier drop not null;
-- alter table public.materials alter column supply_type drop not null;
-- alter table public.materials drop constraint if exists materials_supply_type_check;
-- alter table public.materials alter column moq drop not null;
-- alter table public.materials alter column unit_price drop not null;
