-- Supabase SQL Editor에서 실행하세요 (setup-orders.sql 이후)
--
-- 품목 마스터 — 내부 PK(id)는 MR-00001 자동채번, 표시 코드는 base_code
-- item_category: 1=원자재, 2=부자재, 3=반제품, 4=조립제품
-- material_type: SMD / DIP (선택)
-- 필수: name, item_category (id 비우면 트리거가 발급)

create table if not exists public.items (
  id text primary key,
  base_code text not null default '',
  version text not null default '',
  name text not null default '',
  specification text not null default '',
  package text not null default '',
  mpn text not null default '',
  material_type text not null default '' check (material_type in ('', 'SMD', 'DIP')),
  supply_type text not null default '' check (supply_type in ('', '도급', '사급')),
  supplier text not null default '',
  unit_price numeric not null default 0,
  smd_unit_price numeric not null default 0 check (smd_unit_price >= 0),
  dip_unit_price numeric not null default 0 check (dip_unit_price >= 0),
  material_unit_price numeric not null default 0 check (material_unit_price >= 0),
  other_unit_price numeric not null default 0,
  setup_unit_price numeric not null default 0 check (setup_unit_price >= 0),
  smt_quote_parts jsonb not null default '{}'::jsonb,
  baseline_quote_id text,
  pcb_side_mode text not null default '' check (pcb_side_mode in ('', 'single', 'duo', 'double')),
  process_type text not null default '' check (process_type in ('', 'smt', 'post', 'smt_post')),
  customer_id text,
  customer_reg_no text,
  safety_stock integer not null default 0 check (safety_stock >= 0),
  item_category smallint not null check (item_category in (1, 2, 3, 4)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_id_not_blank_check check (length(trim(id)) > 0)
);

-- 기존 DB: 신규 컬럼 보강 (create table if not exists 는 기존 테이블에 컬럼을 추가하지 않음)
alter table public.items
  add column if not exists base_code text not null default '';
alter table public.items
  add column if not exists version text not null default '';
alter table public.items
  add column if not exists specification text not null default '';
alter table public.items
  add column if not exists package text not null default '';
alter table public.items
  add column if not exists mpn text not null default '';
alter table public.items
  add column if not exists material_type text not null default '';
alter table public.items
  add column if not exists supply_type text not null default '';
alter table public.items
  add column if not exists supplier text not null default '';
alter table public.items
  add column if not exists unit_price numeric not null default 0;
alter table public.items
  add column if not exists smd_unit_price numeric not null default 0;
alter table public.items
  add column if not exists dip_unit_price numeric not null default 0;
alter table public.items
  add column if not exists material_unit_price numeric not null default 0;
alter table public.items
  add column if not exists other_unit_price numeric not null default 0;
alter table public.items
  add column if not exists setup_unit_price numeric not null default 0;
alter table public.items
  add column if not exists smt_quote_parts jsonb not null default '{}'::jsonb;
alter table public.items
  add column if not exists baseline_quote_id text;
alter table public.items
  add column if not exists pcb_side_mode text not null default '';
alter table public.items
  add column if not exists process_type text not null default '';
alter table public.items
  add column if not exists customer_reg_no text;
alter table public.items
  add column if not exists customer_id text;
alter table public.items
  add column if not exists safety_stock integer not null default 0;
alter table public.items
  drop constraint if exists items_safety_stock_check;
alter table public.items
  add constraint items_safety_stock_check check (safety_stock >= 0);
alter table public.items
  add column if not exists item_category smallint;
alter table public.items
  add column if not exists is_active boolean not null default true;
alter table public.items
  add column if not exists created_at timestamptz not null default now();
alter table public.items
  add column if not exists updated_at timestamptz not null default now();

comment on table public.items is '품목 마스터 — 내부 PK=id(MR-00001), 표시 코드=base_code, 버전=version';
comment on column public.items.id is '내부 품목 PK. 저장 시 MR-00001 형식으로 자동 발급, 이후 변경 불가';
comment on column public.items.base_code is '표시용 품목코드 (고객사 코드 등, 버전 제외)';
comment on column public.items.version is '버전 라벨 (A1, V2 등). 원자재는 빈 문자열';
comment on column public.items.name is '품목명 (필수)';
comment on column public.items.specification is '규격';
comment on column public.items.package is 'Package — 원자재(1)';
comment on column public.items.mpn is 'MPN';
comment on column public.items.material_type is 'SMD / DIP (선택)';
comment on column public.items.supply_type is '도급/사급 (선택)';
comment on column public.items.supplier is '공급사 — 원자재·부자재';
comment on column public.items.unit_price is '대당 단가 참고 (SMD+후공정, 반제품)';
comment on column public.items.smd_unit_price is 'SMD 대당 단가 — 반제품(3)';
comment on column public.items.dip_unit_price is '후공정 대당 단가 — 반제품(3)';
comment on column public.items.material_unit_price is '자재 대당 단가 — 반제품(3), 발주 시 수량×단가';
comment on column public.items.other_unit_price is '레거시 — SET-UP과 동일 값으로 동기화';
comment on column public.items.setup_unit_price is 'SET-UP 전체 비용 (발주 시 1회 청구)';
comment on column public.items.smt_quote_parts is '레거시 종수 스냅샷';
comment on column public.items.baseline_quote_id is '기준 견적서 quotations.id — 종수·SET-UP 산정 소스';
comment on column public.items.pcb_side_mode is '면 구분 — 단면(single)/듀얼(duo)/양면(double) — 반제품(3)만 사용';
comment on column public.items.process_type is '공정 — 반제품(3)만: smt=SMD, post=후공정, smt_post=SMD+후공정';
comment on column public.items.safety_stock is '안전재고(최소 보유 수량). 현재고가 이보다 작으면 미달';
comment on column public.items.item_category is '1=원자재, 2=부자재, 3=반제품, 4=조립제품 (필수)';
comment on column public.items.is_active is '사용 여부';

create index if not exists items_name_idx on public.items (name);
create index if not exists items_base_code_idx on public.items (base_code);
create index if not exists items_mpn_idx on public.items (mpn);
create index if not exists items_material_type_idx on public.items (material_type);
create index if not exists items_supplier_idx on public.items (supplier);
create index if not exists items_process_type_idx on public.items (process_type) where process_type <> '';
create index if not exists items_item_category_idx on public.items (item_category);
create index if not exists items_is_active_idx on public.items (is_active);
create index if not exists items_customer_id_idx on public.items (customer_id);
create index if not exists items_baseline_quote_id_idx
  on public.items (baseline_quote_id)
  where baseline_quote_id is not null;
create unique index if not exists items_base_code_name_version_uidx
  on public.items (
    lower(btrim(base_code)),
    lower(btrim(name)),
    lower(btrim(version))
  );

-- 원자재만 품목코드 유일 (반·조립은 위 코드+품명+버전 유니크)
create unique index if not exists items_raw_material_base_code_uidx
  on public.items (lower(btrim(base_code)))
  where item_category = 1;

create sequence if not exists public.item_id_seq;

create or replace function public.generate_item_id()
returns text
language plpgsql
as $$
declare
  next_num bigint;
  candidate text;
begin
  loop
    next_num := nextval('public.item_id_seq');
    candidate := 'MR-' || lpad(next_num::text, 5, '0');
    exit when not exists (
      select 1 from public.items where id = candidate
    );
  end loop;
  return candidate;
end;
$$;

grant execute on function public.generate_item_id() to anon, authenticated;

alter table public.items enable row level security;

drop policy if exists "items public read" on public.items;
create policy "items public read" on public.items for select using (true);

drop policy if exists "items public insert" on public.items;
create policy "items public insert" on public.items for insert with check (true);

drop policy if exists "items public update" on public.items;
create policy "items public update" on public.items for update using (true) with check (true);

drop policy if exists "items public delete" on public.items;
create policy "items public delete" on public.items for delete using (true);

create or replace function public.touch_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.normalize_items_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.id := coalesce(trim(new.id), '');
    -- 비어 있거나 구형식(품목코드-버전 등)이면 내부 PK를 새로 발급
    if new.id = '' or new.id !~ '^MR-[0-9]{5,}$' then
      new.id := public.generate_item_id();
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.name := coalesce(trim(new.name), '');
  if new.name = '' then
    raise exception '품목명은 필수입니다.';
  end if;

  new.specification := coalesce(trim(new.specification), '');
  new.package := coalesce(trim(new.package), '');
  new.mpn := coalesce(trim(new.mpn), '');
  new.customer_id := nullif(btrim(coalesce(new.customer_id, '')), '');
  new.customer_reg_no := nullif(btrim(coalesce(new.customer_reg_no, '')), '');

  new.material_type := upper(coalesce(trim(new.material_type), ''));
  if new.material_type not in ('', 'SMD', 'DIP') then
    new.material_type := '';
  end if;

  new.supply_type := coalesce(trim(new.supply_type), '');
  if new.supply_type not in ('', '도급', '사급') then
    new.supply_type := '';
  end if;

  new.smd_unit_price := coalesce(new.smd_unit_price, 0);
  if new.smd_unit_price < 0 then
    new.smd_unit_price := 0;
  end if;

  new.dip_unit_price := coalesce(new.dip_unit_price, 0);
  if new.dip_unit_price < 0 then
    new.dip_unit_price := 0;
  end if;

  new.material_unit_price := coalesce(new.material_unit_price, 0);
  if new.material_unit_price < 0 then
    new.material_unit_price := 0;
  end if;

  new.other_unit_price := coalesce(new.other_unit_price, 0);

  new.unit_price := coalesce(new.unit_price, 0);
  if new.item_category is distinct from 3 and new.unit_price < 0 then
    new.unit_price := 0;
  end if;

  if new.item_category is null or new.item_category not in (1, 2, 3, 4) then
    raise exception '품목구분(1~4)은 필수입니다.';
  end if;

  new.pcb_side_mode := lower(coalesce(trim(new.pcb_side_mode), ''));
  -- 레거시 dual(양면) → double
  if new.pcb_side_mode = 'dual' then
    new.pcb_side_mode := 'double';
  end if;
  if new.pcb_side_mode not in ('', 'single', 'duo', 'double') then
    new.pcb_side_mode := '';
  end if;
  if new.item_category <> 3 then
    new.pcb_side_mode := '';
  elsif new.pcb_side_mode = '' then
    new.pcb_side_mode := 'single';
  end if;

  new.process_type := lower(coalesce(trim(new.process_type), ''));
  if new.process_type not in ('', 'smt', 'post', 'smt_post') then
    new.process_type := '';
  end if;

  if new.item_category not in (3, 4) then
    new.process_type := '';
  elsif coalesce(new.unit_price, 0) = 0 then
    new.unit_price :=
      coalesce(new.smd_unit_price, 0)
      + coalesce(new.dip_unit_price, 0);
  end if;

  if new.item_category in (3, 4) and new.process_type = '' then
    if new.smd_unit_price > 0 and new.dip_unit_price > 0 then
      new.process_type := 'smt_post';
    elsif new.smd_unit_price > 0 then
      new.process_type := 'smt';
    elsif new.dip_unit_price > 0 then
      new.process_type := 'post';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists items_normalize_row on public.items;
create trigger items_normalize_row
  before insert or update on public.items
  for each row
  execute function public.normalize_items_row();

drop index if exists public.items_manufacturer_idx;
alter table public.items drop column if exists manufacturer;

drop trigger if exists items_updated_at on public.items;
create trigger items_updated_at
  before update on public.items
  for each row
  execute function public.touch_items_updated_at();

-- 주문 라인 품목 FK
alter table public.order_lines
  add column if not exists product_id text references public.items(id) on delete set null;

alter table public.order_lines
  add column if not exists derived_from_line_id uuid references public.order_lines(id) on delete cascade;

create index if not exists order_lines_product_id_idx on public.order_lines (product_id);

create unique index if not exists order_lines_derived_parent_product_unique_idx
  on public.order_lines (derived_from_line_id, product_id)
  where derived_from_line_id is not null;

comment on column public.order_lines.product_id is '품목 FK (items.id)';
comment on column public.order_lines.product_code is '표시용 품목코드 (items.base_code 스냅샷)';
comment on column public.order_lines.derived_from_line_id is '조립제품 주문 줄에서 BOM 펼침으로 생성된 반제품 줄 (주문 UI 비표시)';

-- 기존 DB: product_id FK 가 products 를 가리키면 items 로 교체
alter table public.order_lines drop constraint if exists order_lines_product_id_fkey;
alter table public.order_lines
  add constraint order_lines_product_id_fkey
  foreign key (product_id) references public.items(id) on delete set null;

do $$
begin
  if to_regclass('public.business_partners') is null then
    return;
  end if;
  alter table public.items drop constraint if exists items_customer_reg_no_fkey;
  alter table public.items drop constraint if exists items_customer_id_fkey;
  alter table public.items
    add constraint items_customer_id_fkey
    foreign key (customer_id) references public.business_partners(id)
    on delete set null;
end;
$$;
