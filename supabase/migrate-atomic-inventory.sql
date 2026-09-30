-- 재고 수량 원자적 증감 (릴 잔량 + 주문별 자재 불출 수량)
-- 기존: 앱에서 수량 조회 → 계산 → 덮어쓰기 (두 사람이 동시에 불출하면 한쪽 차감이 사라질 수 있음)
-- 변경: DB 한 문장에서 "수량 확인 + 증감" 을 함께 처리
-- migrate-material-reel-remaining.sql, migrate-material-order-allocations.sql 이후,
-- Supabase SQL Editor에서 실행하세요. (적용 전에도 앱은 기존 방식으로 동작합니다)

-- 1) 릴 잔량

create or replace function public.adjust_material_reel_remaining(
  p_inbound_line_id uuid,
  p_delta numeric,
  p_strict boolean default true
)
returns numeric
language plpgsql
as $$
declare
  v_next numeric;
begin
  if p_strict then
    update public.material_inbound_lines
       set remaining_qty = coalesce(remaining_qty, 0) + p_delta,
           location_status = case when coalesce(remaining_qty, 0) + p_delta > 0 then 'warehouse' else 'line' end
     where id = p_inbound_line_id
       and coalesce(remaining_qty, 0) + p_delta >= 0
       and coalesce(remaining_qty, 0) + p_delta <= quantity
    returning remaining_qty into v_next;

    if not found then
      if exists (select 1 from public.material_inbound_lines where id = p_inbound_line_id) then
        raise exception 'REEL_REMAINING_OUT_OF_RANGE: 릴 잔량이 부족하거나 릴 수량을 초과합니다.';
      end if;
      raise exception 'REEL_NOT_FOUND: 릴을 찾을 수 없습니다.';
    end if;
  else
    update public.material_inbound_lines
       set remaining_qty = greatest(0, least(quantity, coalesce(remaining_qty, 0) + p_delta)),
           location_status = case
             when greatest(0, least(quantity, coalesce(remaining_qty, 0) + p_delta)) > 0 then 'warehouse'
             else 'line'
           end
     where id = p_inbound_line_id
    returning remaining_qty into v_next;
  end if;

  return v_next;
end;
$$;

comment on function public.adjust_material_reel_remaining(uuid, numeric, boolean) is
  '릴 잔량 원자적 증감 — strict=true 면 0 미만/릴 수량 초과 시 오류, false 면 범위로 보정';

-- security invoker(기본값) → 호출자의 RLS 정책이 그대로 적용됩니다.
grant execute on function public.adjust_material_reel_remaining(uuid, numeric, boolean) to anon, authenticated;

-- 2) 주문별 자재 불출 수량 (material_order_allocations)
--    p_issued_delta > 0 : 불출 — issued 증가, reserved 감소 (행 없으면 생성)
--    p_issued_delta < 0 : 잔량반납 — issued 감소, reserved 증가 (행 없으면 무시)
create or replace function public.apply_material_allocation_issue(
  p_order_id text,
  p_material_id text,
  p_issued_delta numeric
)
returns void
language plpgsql
as $$
begin
  if p_issued_delta > 0 then
    insert into public.material_order_allocations as a
      (order_id, material_id, required_qty, reserved_qty, issued_qty, updated_at)
    values (p_order_id, p_material_id, p_issued_delta, 0, p_issued_delta, now())
    on conflict (order_id, material_id) do update
      set issued_qty = a.issued_qty + p_issued_delta,
          reserved_qty = greatest(0, a.reserved_qty - p_issued_delta),
          required_qty = greatest(a.required_qty, a.issued_qty + p_issued_delta),
          updated_at = now();
  elsif p_issued_delta < 0 then
    update public.material_order_allocations
       set issued_qty = greatest(0, issued_qty + p_issued_delta),
           reserved_qty = reserved_qty - p_issued_delta,
           updated_at = now()
     where order_id = p_order_id
       and material_id = p_material_id;
  end if;
end;
$$;

comment on function public.apply_material_allocation_issue(text, text, numeric) is
  '주문×자재 불출/반납 수량 원자적 반영';

grant execute on function public.apply_material_allocation_issue(text, text, numeric) to anon, authenticated;

-- 적용 이력 기록 (setup-schema-migrations.sql 실행 후에만 기록됨)
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    insert into public.schema_migrations (filename) values ('migrate-atomic-inventory.sql') on conflict do nothing;
  end if;
end $$;
