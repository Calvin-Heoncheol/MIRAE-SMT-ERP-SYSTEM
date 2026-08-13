-- 출하 shipment_id null 제약 오류 수정
-- 원인: id 발급 전에 shipment_id := new.id 하면 null 이 들어가 NOT NULL 위반
-- Supabase SQL Editor에서 실행 (멱등)

-- 1) 깨진 단독 트리거 제거
drop trigger if exists delivery_records_default_shipment_id on public.delivery_records;
drop function if exists public.delivery_records_default_shipment_id();

-- 2) id 먼저 채운 뒤 shipment_id 보정
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

drop trigger if exists delivery_records_set_id on public.delivery_records;
create trigger delivery_records_set_id
  before insert on public.delivery_records
  for each row
  execute function public.delivery_records_set_id();

-- 3) 기존 null / 빈 값 정리
alter table public.delivery_records
  add column if not exists shipment_id text;

update public.delivery_records
set shipment_id = id
where shipment_id is null or btrim(shipment_id) = '';

alter table public.delivery_records
  alter column shipment_id set default '';

update public.delivery_records
set shipment_id = id
where shipment_id is null or btrim(shipment_id) = '';

alter table public.delivery_records
  alter column shipment_id set not null;

-- 4) RPC 를 shipment_id 포함 버전으로 교체
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
    -- '' 로 넣으면 BEFORE INSERT 트리거가 id 발급 후 shipment_id = id 로 채움
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
