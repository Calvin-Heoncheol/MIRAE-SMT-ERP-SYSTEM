-- 입고 라인 = 릴 원장 (remaining_qty). 현재고 = 창고 remaining 합.
-- 불출 라인에 LOT·입고라인 FK. 잔량반납 유형 restock.
-- Supabase SQL Editor에서 실행하세요.

alter table public.material_inbound_lines
  add column if not exists remaining_qty numeric;

alter table public.material_inbound_lines
  add column if not exists location_status text not null default 'warehouse';

update public.material_inbound_lines
set remaining_qty = quantity
where remaining_qty is null;

alter table public.material_inbound_lines
  alter column remaining_qty set default 0;

alter table public.material_inbound_lines
  alter column remaining_qty set not null;

alter table public.material_inbound_lines
  drop constraint if exists material_inbound_lines_remaining_qty_check;

alter table public.material_inbound_lines
  add constraint material_inbound_lines_remaining_qty_check
  check (remaining_qty >= 0 and remaining_qty <= quantity);

alter table public.material_inbound_lines
  drop constraint if exists material_inbound_lines_location_status_check;

alter table public.material_inbound_lines
  add constraint material_inbound_lines_location_status_check
  check (location_status in ('warehouse', 'line'));

comment on column public.material_inbound_lines.remaining_qty is '창고에 남은 수량. 불출 시 감소, 잔량반납 시 증가';
comment on column public.material_inbound_lines.location_status is 'warehouse=창고, line=라인 지급 중(잔량 0)';

create index if not exists material_inbound_lines_remaining_idx
  on public.material_inbound_lines (material_id)
  where remaining_qty > 0;

alter table public.material_outbound_lines
  add column if not exists lot_number text not null default '';

alter table public.material_outbound_lines
  add column if not exists inbound_line_id uuid references public.material_inbound_lines(id) on delete restrict;

comment on column public.material_outbound_lines.lot_number is '지급/반납한 릴 LOT';
comment on column public.material_outbound_lines.inbound_line_id is '입고 릴 원장 FK';

create index if not exists material_outbound_lines_inbound_line_id_idx
  on public.material_outbound_lines (inbound_line_id)
  where inbound_line_id is not null;

alter table public.material_outbound_records
  drop constraint if exists material_outbound_records_outbound_type_check;

alter table public.material_outbound_records
  add constraint material_outbound_records_outbound_type_check
  check (outbound_type in ('production', 'scrap', 'adjustment', 'restock'));

alter table public.material_outbound_records
  drop constraint if exists material_outbound_records_order_check;

alter table public.material_outbound_records
  add constraint material_outbound_records_order_check check (
    (outbound_type in ('production', 'restock') and order_id is not null)
    or (outbound_type not in ('production', 'restock'))
  );

create or replace function public.normalize_material_inbound_reel_row()
returns trigger
language plpgsql
as $$
begin
  if new.remaining_qty is null or (tg_op = 'INSERT' and new.remaining_qty = 0 and new.quantity > 0) then
    new.remaining_qty := new.quantity;
  end if;
  if new.remaining_qty > 0 then
    new.location_status := 'warehouse';
  else
    new.location_status := 'line';
  end if;
  return new;
end;
$$;

drop trigger if exists material_inbound_lines_normalize_reel on public.material_inbound_lines;
create trigger material_inbound_lines_normalize_reel
  before insert on public.material_inbound_lines
  for each row
  execute function public.normalize_material_inbound_reel_row();

-- 기존 품목 불출을 오래된 릴 remaining에서 FIFO로 차감 (이력 라인은 그대로)
do $$
declare
  o record;
  need numeric;
  take numeric;
  r record;
begin
  for o in
    select l.id as line_id, l.material_id, l.quantity
    from public.material_outbound_lines l
    join public.material_outbound_records h on h.id = l.outbound_id
    where l.inbound_line_id is null
      and h.outbound_type in ('production', 'scrap', 'adjustment')
    order by h.created_at, l.line_seq
  loop
    need := o.quantity;
    for r in
      select il.id, il.remaining_qty
      from public.material_inbound_lines il
      join public.material_inbound_records ir on ir.id = il.inbound_id
      where il.material_id = o.material_id
        and il.remaining_qty > 0
      order by ir.inbound_date, ir.created_at, il.line_seq
    loop
      exit when need <= 0;
      take := least(r.remaining_qty, need);
      update public.material_inbound_lines
      set
        remaining_qty = remaining_qty - take,
        location_status = case when remaining_qty - take <= 0 then 'line' else 'warehouse' end
      where id = r.id;
      need := need - take;
    end loop;
  end loop;
end $$;

create or replace view public.material_on_hand as
select
  material_id,
  coalesce(sum(remaining_qty), 0)::numeric as on_hand
from public.material_inbound_lines
group by material_id;

comment on view public.material_on_hand is '자재별 현재고 = 릴 remaining_qty 합 (창고 실물)';

grant select on public.material_on_hand to anon, authenticated;
