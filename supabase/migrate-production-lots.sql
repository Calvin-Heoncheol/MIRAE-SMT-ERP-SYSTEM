-- 생산 LOT + 출하 LOT 배정
-- LOT-YYMMDD-NN (생산일 기준 일련)
-- 후공정(또는 SMT-only) 양품을 조립그룹·일자로 묶고, 출하 시 FIFO 차감

create table if not exists public.production_lots (
  id text primary key,
  lot_date date not null,
  assembly_group_id uuid not null references public.order_assembly_groups(id) on delete cascade,
  product_code text not null default '',
  product_name text not null default '',
  order_id text not null default '',
  quantity integer not null check (quantity > 0),
  source text not null default 'production',
  created_at timestamptz not null default now(),
  constraint production_lots_id_format_check check (id ~ '^LOT-[0-9]{6}-[0-9]{2,}$'),
  constraint production_lots_group_date_unique unique (assembly_group_id, lot_date)
);

comment on table public.production_lots is '생산 LOT — 조립그룹·생산일 단위 양품';
comment on column public.production_lots.id is 'LOT-YYMMDD-NN';
comment on column public.production_lots.quantity is '해당일 양품(출하 단위) 수량';

create index if not exists production_lots_assembly_group_id_idx
  on public.production_lots (assembly_group_id);

create index if not exists production_lots_lot_date_idx
  on public.production_lots (lot_date, id);

create table if not exists public.delivery_record_lots (
  id uuid primary key default gen_random_uuid(),
  delivery_record_id text not null references public.delivery_records(id) on delete cascade,
  lot_id text not null references public.production_lots(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  constraint delivery_record_lots_unique unique (delivery_record_id, lot_id)
);

comment on table public.delivery_record_lots is '출하 라인에 배정된 생산 LOT';

create index if not exists delivery_record_lots_delivery_record_id_idx
  on public.delivery_record_lots (delivery_record_id);

create index if not exists delivery_record_lots_lot_id_idx
  on public.delivery_record_lots (lot_id);

create or replace function public.generate_production_lot_number(
  p_lot_date date default (timezone('Asia/Seoul', now()))::date
)
returns text
language plpgsql
as $$
declare
  d date;
  prefix text;
  max_suffix integer := 0;
  row_id text;
  suffix_text text;
  suffix_num integer;
begin
  d := coalesce(p_lot_date, (timezone('Asia/Seoul', now()))::date);
  prefix := 'LOT-' || to_char(d, 'YYMMDD');

  for row_id in
    select id from public.production_lots where id like prefix || '-%'
  loop
    suffix_text := substring(row_id from length(prefix) + 2);
    begin
      suffix_num := suffix_text::integer;
      if suffix_num > max_suffix then
        max_suffix := suffix_num;
      end if;
    exception
      when invalid_text_representation then
        null;
    end;
  end loop;

  return prefix || '-' || lpad((max_suffix + 1)::text, 2, '0');
end;
$$;

comment on function public.generate_production_lot_number(date) is 'LOT-YYMMDD-NN';

grant execute on function public.generate_production_lot_number(date) to anon, authenticated;

alter table public.production_lots enable row level security;
alter table public.delivery_record_lots enable row level security;

drop policy if exists "production_lots public read" on public.production_lots;
create policy "production_lots public read"
  on public.production_lots for select using (true);

drop policy if exists "production_lots public insert" on public.production_lots;
create policy "production_lots public insert"
  on public.production_lots for insert with check (true);

drop policy if exists "production_lots public update" on public.production_lots;
create policy "production_lots public update"
  on public.production_lots for update using (true) with check (true);

drop policy if exists "production_lots public delete" on public.production_lots;
create policy "production_lots public delete"
  on public.production_lots for delete using (true);

drop policy if exists "delivery_record_lots public read" on public.delivery_record_lots;
create policy "delivery_record_lots public read"
  on public.delivery_record_lots for select using (true);

drop policy if exists "delivery_record_lots public insert" on public.delivery_record_lots;
create policy "delivery_record_lots public insert"
  on public.delivery_record_lots for insert with check (true);

drop policy if exists "delivery_record_lots public update" on public.delivery_record_lots;
create policy "delivery_record_lots public update"
  on public.delivery_record_lots for update using (true) with check (true);

drop policy if exists "delivery_record_lots public delete" on public.delivery_record_lots;
create policy "delivery_record_lots public delete"
  on public.delivery_record_lots for delete using (true);

-- 기존 후공정 양품 → 일자별 LOT 백필 (채번은 함수로 충돌 방지)
do $$
declare
  r record;
  new_id text;
begin
  for r in
    select
      g.record_date,
      g.assembly_group_id,
      g.qty,
      coalesce(i.id, ag.parent_product_id, '') as product_code,
      coalesce(i.name, '') as product_name,
      coalesce(ag.order_id, '') as order_id
    from (
      select
        p.record_date,
        p.assembly_group_id,
        sum(p.quantity)::integer as qty
      from public.post_process_production_records p
      where p.quantity > 0
      group by p.record_date, p.assembly_group_id
    ) g
    join public.order_assembly_groups ag on ag.id = g.assembly_group_id
    left join public.items i on i.id = ag.parent_product_id
    where not exists (
      select 1
      from public.production_lots existing
      where existing.assembly_group_id = g.assembly_group_id
        and existing.lot_date = g.record_date
    )
    order by g.record_date, g.assembly_group_id
  loop
    if r.qty is null or r.qty < 1 then
      continue;
    end if;
    new_id := public.generate_production_lot_number(r.record_date);
    insert into public.production_lots (
      id,
      lot_date,
      assembly_group_id,
      product_code,
      product_name,
      order_id,
      quantity,
      source
    ) values (
      new_id,
      r.record_date,
      r.assembly_group_id,
      r.product_code,
      r.product_name,
      r.order_id,
      r.qty,
      'backfill'
    );
  end loop;
end $$;
