-- Supabase SQL Editorì—ì„œ ì‹¤í–‰í•˜ì„¸ìš” (setup-bom.sql ì´í›„)
--
-- ì¶œí•˜ìž…ë ¥: ì¡°ë¦½ ê·¸ë£¹(ì¡°ë¦½ì œí’ˆ ì„¸íŠ¸)ë³„ ì¶œí•˜(ë‚©í’ˆ) ì‹¤ì  ê¸°ë¡
-- id = MRS-YYMMDD-NN (record_date daily seq); legacy MRS-NNNN still allowed
-- final schema: shipment_id, created_by*, insert_delivery_record_atomic

create table if not exists public.delivery_records (
  id text primary key,
  record_date date not null default (timezone('Asia/Seoul', now()))::date,
  assembly_group_id uuid references public.order_assembly_groups(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  source text not null default 'manual' check (source in ('manual')),
  note text not null default '',
  shipment_id text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  constraint delivery_records_id_mrs_format_check check (
    id ~ '^MRS-[0-9]+$'
    or id ~ '^MRS-[0-9]{6}-[0-9]{2}$'
  )
);

comment on table public.delivery_records is 'ì¶œí•˜(ë‚©í’ˆ) ì‹¤ì  â€” MRS-0001';
comment on column public.delivery_records.id is 'ì¶œí•˜ ë¼ì¸ë²ˆí˜¸ MRS-0001 (INSERT ì‹œ ìžë™ ë°œê¸‰)';
comment on column public.delivery_records.record_date is 'ê¸°ë¡ì¼ìž (KST)';
comment on column public.delivery_records.assembly_group_id is 'ì£¼ë¬¸ ì¡°ë¦½ ê·¸ë£¹ FK (order_assembly_groups.id)';
comment on column public.delivery_records.quantity is 'ì´ë²ˆ ë“±ë¡ ì¶œí•˜(ë‚©í’ˆ) ìˆ˜ëŸ‰';
comment on column public.delivery_records.source is 'manual=ì¶œí•˜ìž…ë ¥ í™”ë©´';
comment on column public.delivery_records.shipment_id is 'ê±°ëž˜ëª…ì„¸ì„œ ë¬¶ìŒë²ˆí˜¸ â€” ê°™ì€ ê°’ì´ë©´ í•œ ìž¥ìœ¼ë¡œ ì¶œë ¥';
comment on column public.delivery_records.created_by is 'ë“±ë¡ìž auth.users.id';
comment on column public.delivery_records.created_by_name is 'ë“±ë¡ìž í‘œì‹œëª… ìŠ¤ëƒ…ìƒ· (profiles.display_name)';

create index if not exists delivery_records_assembly_group_id_idx
  on public.delivery_records (assembly_group_id);

create index if not exists delivery_records_record_date_idx
  on public.delivery_records (record_date desc);

create index if not exists delivery_records_created_at_idx
  on public.delivery_records (created_at desc);

create index if not exists delivery_records_shipment_id_idx
  on public.delivery_records (shipment_id);

create index if not exists delivery_records_record_date_shipment_id_idx
  on public.delivery_records (record_date desc, shipment_id);

create index if not exists delivery_records_created_by_idx
  on public.delivery_records (created_by);

drop view if exists public.delivery_totals;

create view public.delivery_totals as
select
  assembly_group_id,
  coalesce(sum(quantity), 0)::integer as total_quantity
from public.delivery_records
group by assembly_group_id;

comment on view public.delivery_totals is 'ì¶œí•˜ ì¡°ë¦½ ê·¸ë£¹ë³„ ëˆ„ì  ë‚©í’ˆ ìˆ˜ëŸ‰';

create or replace function public.generate_delivery_number(
  p_record_date date default (timezone('Asia/Seoul', now()))::date
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
  d := coalesce(p_record_date, (timezone('Asia/Seoul', now()))::date);
  prefix := 'MRS-' || to_char(d, 'YYMMDD');

  for row_id in
    select id
    from public.delivery_records
    where id like prefix || '-%'
       or record_date = d
  loop
    if length(row_id) = length(prefix) + 3
       and row_id like prefix || '-__' then
      suffix_text := right(row_id, 2);
      begin
        suffix_num := suffix_text::integer;
        if suffix_num > max_suffix then
          max_suffix := suffix_num;
        end if;
      exception
        when invalid_text_representation then
          null;
      end;
    end if;
  end loop;

  return prefix || '-' || lpad((max_suffix + 1)::text, 2, '0');
end;
$$;

comment on function public.generate_delivery_number(date) is 'MRS-YYMMDD-NN (record_date day seq)';

grant execute on function public.generate_delivery_number(date) to anon, authenticated;

-- id ë¨¼ì € ì±„ìš´ ë’¤ shipment_id ì±„ì›€ (null NOT NULL ìœ„ë°˜ ë°©ì§€)
create or replace function public.delivery_records_set_id()
returns trigger
language plpgsql
as $$
begin
  if coalesce(btrim(new.id::text), '') = '' then
    new.id := public.generate_delivery_number(new.record_date);
  end if;
  if coalesce(btrim(new.shipment_id), '') = '' then
    new.shipment_id := new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_records_default_shipment_id on public.delivery_records;
drop function if exists public.delivery_records_default_shipment_id();

drop trigger if exists delivery_records_set_id on public.delivery_records;
create trigger delivery_records_set_id
  before insert on public.delivery_records
  for each row
  execute function public.delivery_records_set_id();

-- ê¸°ì¡´ DB ë³´ê°•
alter table public.delivery_records
  add column if not exists shipment_id text;
alter table public.delivery_records
  add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.delivery_records
  add column if not exists created_by_name text not null default '';
update public.delivery_records
set shipment_id = id
where shipment_id is null or btrim(shipment_id) = '';
alter table public.delivery_records
  alter column shipment_id set default '';
update public.delivery_records
set shipment_id = id
where shipment_id is null or btrim(shipment_id) = '';
do $$
begin
  alter table public.delivery_records alter column shipment_id set not null;
exception
  when others then null;
end $$;

create index if not exists delivery_records_created_by_idx
  on public.delivery_records (created_by);

alter table public.delivery_records enable row level security;

drop policy if exists "delivery_records public read" on public.delivery_records;
create policy "delivery_records public read"
  on public.delivery_records for select using (true);

drop policy if exists "delivery_records public insert" on public.delivery_records;
create policy "delivery_records public insert"
  on public.delivery_records for insert with check (true);

drop policy if exists "delivery_records public update" on public.delivery_records;
create policy "delivery_records public update"
  on public.delivery_records for update using (true) with check (true);

drop policy if exists "delivery_records public delete" on public.delivery_records;
create policy "delivery_records public delete"
  on public.delivery_records for delete using (true);

grant select on public.delivery_totals to anon, authenticated;

-- =============================================================================
-- Atomic RPC (ìµœì¢…: migrate-delivery-shipment-id-fix.sql ê³¼ ë™ì¼)
-- =============================================================================

drop function if exists public.insert_delivery_record_atomic(
  uuid, integer, integer, date, text, text, text, uuid, text
);
drop function if exists public.insert_delivery_record_atomic(
  uuid, integer, integer, date, text, text, text, uuid, text, text
);

create or replace function public.insert_delivery_record_atomic(
  p_assembly_group_id uuid,
  p_quantity integer,
  p_max_shippable integer,
  p_record_date date,
  p_source text default 'manual',
  p_note text default '',
  p_shipment_id text default null,
  p_created_by uuid default null,
  p_created_by_name text default '',
  p_shipment_group_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_target integer;
  v_done integer;
  v_remaining integer;
  v_cap integer;
  v_row public.delivery_records%rowtype;
  v_group text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_assembly_group_id is null then
    raise exception 'ASSEMBLY_GROUP_REQUIRED';
  end if;
  if coalesce(p_quantity, 0) < 1 then
    raise exception 'QUANTITY_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtext('delivery:' || p_assembly_group_id::text));

  select greatest(0, floor(coalesce(target_quantity, 0)))
    into v_target
  from public.order_assembly_groups
  where id = p_assembly_group_id
  for update;

  if not found then
    raise exception 'ASSEMBLY_GROUP_NOT_FOUND';
  end if;

  select coalesce(sum(quantity), 0)::integer
    into v_done
  from public.delivery_records
  where assembly_group_id = p_assembly_group_id;

  v_remaining := case when v_target > 0 then greatest(0, v_target - v_done) else p_quantity end;
  v_cap := least(v_remaining, greatest(0, coalesce(p_max_shippable, 0)));

  if p_quantity > v_cap then
    raise exception 'DELIVERY_EXCEEDED:%', v_cap;
  end if;

  v_group := nullif(trim(coalesce(p_shipment_group_id, '')), '');

  insert into public.delivery_records (
    id,
    record_date,
    assembly_group_id,
    quantity,
    source,
    note,
    created_by,
    created_by_name,
    shipment_id
  ) values (
    nullif(trim(coalesce(p_shipment_id, '')), ''),
    coalesce(p_record_date, current_date),
    p_assembly_group_id,
    p_quantity,
    coalesce(nullif(trim(p_source), ''), 'manual'),
    coalesce(p_note, ''),
    p_created_by,
    coalesce(p_created_by_name, ''),
    -- '' ë¡œ ë„£ìœ¼ë©´ BEFORE INSERT íŠ¸ë¦¬ê±°ê°€ id ë°œê¸‰ í›„ shipment_id = id ë¡œ ì±„ì›€
    coalesce(v_group, '')
  )
  returning * into v_row;

  if coalesce(btrim(v_row.shipment_id), '') = '' then
    update public.delivery_records
    set shipment_id = v_row.id
    where id = v_row.id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'record', to_jsonb(v_row),
    'cumulative', v_done + p_quantity
  );
end;
$$;

revoke all on function public.insert_delivery_record_atomic(
  uuid, integer, integer, date, text, text, text, uuid, text, text
) from public;

grant execute on function public.insert_delivery_record_atomic(
  uuid, integer, integer, date, text, text, text, uuid, text, text
) to authenticated;
