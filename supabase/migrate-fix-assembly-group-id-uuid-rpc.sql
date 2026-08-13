-- =============================================================================
-- 후공정·출하 원자 등록 RPC: assembly_group_id 타입 수정
-- =============================================================================
-- 증상: operator does not exist: uuid = text
-- 원인: order_assembly_groups.id / *.assembly_group_id 는 uuid 인데
--       RPC 인자가 text 라서 where id = p_assembly_group_id 비교가 실패
--
-- Supabase SQL Editor에서 실행하세요.
-- =============================================================================

drop function if exists public.insert_post_process_production_atomic(
  text, integer, integer, date, text, text, text, uuid, text
);

drop function if exists public.insert_delivery_record_atomic(
  text, integer, integer, date, text, text, text, uuid, text
);

create or replace function public.insert_post_process_production_atomic(
  p_assembly_group_id uuid,
  p_quantity integer,
  p_defect_quantity integer,
  p_record_date date,
  p_source text default 'manual',
  p_team text default '',
  p_note text default '',
  p_created_by uuid default null,
  p_created_by_name text default ''
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
  v_defect_done integer;
  v_row public.post_process_production_records%rowtype;
  v_qty integer := greatest(0, coalesce(p_quantity, 0));
  v_defect integer := greatest(0, coalesce(p_defect_quantity, 0));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_assembly_group_id is null then
    raise exception 'ASSEMBLY_GROUP_REQUIRED';
  end if;
  if v_qty < 1 and v_defect < 1 then
    raise exception 'QUANTITY_REQUIRED';
  end if;
  if v_qty > 0 and v_defect > 0 then
    raise exception 'QTY_OR_DEFECT_ONLY';
  end if;

  perform pg_advisory_xact_lock(hashtext('post:' || p_assembly_group_id::text));

  select greatest(0, floor(coalesce(target_quantity, 0)))
    into v_target
  from public.order_assembly_groups
  where id = p_assembly_group_id
  for update;

  if not found then
    raise exception 'ASSEMBLY_GROUP_NOT_FOUND';
  end if;

  select
    coalesce(sum(quantity), 0)::integer,
    coalesce(sum(coalesce(defect_quantity, 0)), 0)::integer
    into v_done, v_defect_done
  from public.post_process_production_records
  where assembly_group_id = p_assembly_group_id;

  v_remaining := case when v_target > 0 then greatest(0, v_target - v_done) else v_qty end;
  if v_qty > 0 and v_qty > v_remaining then
    raise exception 'POST_EXCEEDED:%', v_remaining;
  end if;

  insert into public.post_process_production_records (
    record_date,
    assembly_group_id,
    quantity,
    defect_quantity,
    source,
    team,
    note,
    created_by,
    created_by_name
  ) values (
    coalesce(p_record_date, current_date),
    p_assembly_group_id,
    v_qty,
    v_defect,
    coalesce(nullif(trim(p_source), ''), 'manual'),
    coalesce(p_team, ''),
    coalesce(p_note, ''),
    p_created_by,
    coalesce(p_created_by_name, '')
  )
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'record', to_jsonb(v_row),
    'cumulative', v_done + v_qty,
    'defectCumulative', v_defect_done + v_defect
  );
exception
  when undefined_column then
    insert into public.post_process_production_records (
      record_date, assembly_group_id, quantity, source, note
    ) values (
      coalesce(p_record_date, current_date),
      p_assembly_group_id,
      v_qty,
      coalesce(nullif(trim(p_source), ''), 'manual'),
      coalesce(p_note, '')
    )
    returning * into v_row;

    return jsonb_build_object(
      'ok', true,
      'record', to_jsonb(v_row),
      'cumulative', v_done + v_qty,
      'defectCumulative', v_defect_done
    );
end;
$$;

create or replace function public.insert_delivery_record_atomic(
  p_assembly_group_id uuid,
  p_quantity integer,
  p_max_shippable integer,
  p_record_date date,
  p_source text default 'manual',
  p_note text default '',
  p_shipment_id text default null,
  p_created_by uuid default null,
  p_created_by_name text default ''
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

  insert into public.delivery_records (
    id,
    record_date,
    assembly_group_id,
    quantity,
    source,
    note,
    created_by,
    created_by_name
  ) values (
    nullif(trim(p_shipment_id), ''),
    coalesce(p_record_date, current_date),
    p_assembly_group_id,
    p_quantity,
    coalesce(nullif(trim(p_source), ''), 'manual'),
    coalesce(p_note, ''),
    p_created_by,
    coalesce(p_created_by_name, '')
  )
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'record', to_jsonb(v_row),
    'cumulative', v_done + p_quantity
  );
exception
  when undefined_column then
    insert into public.delivery_records (
      id, record_date, assembly_group_id, quantity, source, note
    ) values (
      nullif(trim(p_shipment_id), ''),
      coalesce(p_record_date, current_date),
      p_assembly_group_id,
      p_quantity,
      coalesce(nullif(trim(p_source), ''), 'manual'),
      coalesce(p_note, '')
    )
    returning * into v_row;

    return jsonb_build_object(
      'ok', true,
      'record', to_jsonb(v_row),
      'cumulative', v_done + p_quantity
    );
end;
$$;

revoke all on function public.insert_post_process_production_atomic(
  uuid, integer, integer, date, text, text, text, uuid, text
) from public;
revoke all on function public.insert_delivery_record_atomic(
  uuid, integer, integer, date, text, text, text, uuid, text
) from public;

grant execute on function public.insert_post_process_production_atomic(
  uuid, integer, integer, date, text, text, text, uuid, text
) to authenticated;
grant execute on function public.insert_delivery_record_atomic(
  uuid, integer, integer, date, text, text, text, uuid, text
) to authenticated;
