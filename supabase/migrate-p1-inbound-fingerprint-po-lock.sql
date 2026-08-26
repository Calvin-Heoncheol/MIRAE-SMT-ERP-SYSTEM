-- =============================================================================
-- P1: 입고 릴 fingerprint 유니크 + PO 입고수량 원자 갱신
-- =============================================================================
-- Supabase SQL Editor에서 한 번 실행하세요.
-- =============================================================================

-- 빈 문자열이 아닌 scan_fingerprint 만 유일 (짧은 바코드로 fingerprint='' 인 경우 제외)
create unique index if not exists material_inbound_lines_scan_fingerprint_uidx
  on public.material_inbound_lines (scan_fingerprint)
  where length(btrim(scan_fingerprint)) > 0;

comment on index public.material_inbound_lines_scan_fingerprint_uidx is
  '릴 스캔 지문 중복 방지 — 빈 fingerprint 는 제외';

-- PO 라인 입고수량 원자 가산 (초과 시 예외)
create or replace function public.apply_po_line_inbound_qty(
  p_line_id uuid,
  p_delta numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ordered numeric;
  v_received numeric;
  v_delta numeric := coalesce(p_delta, 0);
  v_next numeric;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_line_id is null then
    raise exception 'PO_LINE_REQUIRED';
  end if;

  if v_delta = 0 then
    return jsonb_build_object('ok', true, 'inboundQuantity', null);
  end if;

  perform pg_advisory_xact_lock(hashtext('po_line:' || p_line_id::text));

  select
    greatest(0, coalesce(quantity, 0)),
    greatest(0, coalesce(inbound_quantity, 0))
  into v_ordered, v_received
  from public.material_purchase_order_lines
  where id = p_line_id
  for update;

  if not found then
    raise exception 'PO_LINE_NOT_FOUND';
  end if;

  v_next := v_received + v_delta;

  if v_delta > 0 and v_next > v_ordered then
    raise exception 'PO_INBOUND_EXCEEDED:%', greatest(0, v_ordered - v_received);
  end if;

  if v_next < 0 then
    v_next := 0;
  end if;

  update public.material_purchase_order_lines
  set inbound_quantity = v_next
  where id = p_line_id;

  return jsonb_build_object(
    'ok', true,
    'inboundQuantity', v_next,
    'orderedQuantity', v_ordered
  );
end;
$$;

revoke all on function public.apply_po_line_inbound_qty(uuid, numeric) from public;
grant execute on function public.apply_po_line_inbound_qty(uuid, numeric) to authenticated;

comment on function public.apply_po_line_inbound_qty(uuid, numeric) is
  '구매발주 라인 입고수량 원자 가산/차감. 초과 시 PO_INBOUND_EXCEEDED';
