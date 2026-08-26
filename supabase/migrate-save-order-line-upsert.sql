-- =============================================================================
-- 주문서 수정: order_lines id upsert (delete-all 제거) + 실적 있는 라인 삭제 금지
-- =============================================================================
-- 배경
--   기존 save_order_update 는 라인을 전부 DELETE 후 INSERT 해서
--   smt_production_* / production_plan_board 등이 ON DELETE CASCADE 로 사라질 수 있음.
--
-- 동작
--   · payload 에 id(uuid) 가 있고 해당 주문 라인이면 UPDATE
--   · 없으면 INSERT
--   · UI 라인(derived_from_line_id is null) 중 payload 에 없는 것만 삭제 시도
--   · 삭제 대상에 SMT 실적·계획·보드가 있으면 LINE_HAS_PRODUCTION 예외
--   · 파생(BOM) 라인은 삭제 후 앱 syncAssemblyGroupsForOrder 가 재생성
--
-- currency 컬럼이 있으면 함께 갱신 (없으면 무시하지 않고 컬럼 있을 때만 set)
-- Supabase SQL Editor에서 한 번 실행하세요.
-- =============================================================================

create or replace function public.save_order_update(
  p_order_id text,
  p_header jsonb,
  p_lines jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_line jsonb;
  v_seq integer := 0;
  v_currency text := upper(coalesce(nullif(trim(p_header ->> 'currency'), ''), 'KRW'));
  v_line_id uuid;
  v_keep_ids uuid[] := array[]::uuid[];
  v_remove record;
  v_has_currency boolean := exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'currency'
  );
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if coalesce(trim(p_order_id), '') = '' then
    raise exception 'ORDER_ID_REQUIRED';
  end if;

  if v_currency not in ('KRW', 'USD') then
    v_currency := 'KRW';
  end if;

  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND:%', p_order_id;
  end if;

  if v_has_currency then
    update public.orders
    set
      order_date = coalesce(nullif(trim(p_header ->> 'order_date'), '')::date, order_date),
      delivery_date = nullif(trim(p_header ->> 'delivery_date'), '')::date,
      customer = coalesce(nullif(trim(p_header ->> 'customer'), ''), customer),
      category = coalesce(nullif(trim(p_header ->> 'category'), ''), category),
      note = coalesce(p_header ->> 'note', note),
      customer_po_number = coalesce(p_header ->> 'customer_po_number', customer_po_number),
      currency = v_currency,
      updated_at = now()
    where id = p_order_id;
  else
    update public.orders
    set
      order_date = coalesce(nullif(trim(p_header ->> 'order_date'), '')::date, order_date),
      delivery_date = nullif(trim(p_header ->> 'delivery_date'), '')::date,
      customer = coalesce(nullif(trim(p_header ->> 'customer'), ''), customer),
      category = coalesce(nullif(trim(p_header ->> 'category'), ''), category),
      note = coalesce(p_header ->> 'note', note),
      customer_po_number = coalesce(p_header ->> 'customer_po_number', customer_po_number),
      updated_at = now()
    where id = p_order_id;
  end if;

  -- 유지할 UI 라인 id 수집
  if p_lines is not null and jsonb_typeof(p_lines) = 'array' then
    for v_line in select * from jsonb_array_elements(p_lines)
    loop
      begin
        v_line_id := nullif(trim(v_line ->> 'id'), '')::uuid;
      exception
        when invalid_text_representation then
          v_line_id := null;
      end;
      if v_line_id is not null then
        v_keep_ids := array_append(v_keep_ids, v_line_id);
      end if;
    end loop;
  end if;

  -- 실적·계획이 있는 UI 라인은 삭제 금지
  for v_remove in
    select ol.id, ol.product_code, ol.product_name
    from public.order_lines ol
    where ol.order_id = p_order_id
      and ol.derived_from_line_id is null
      and (cardinality(v_keep_ids) = 0 or not (ol.id = any (v_keep_ids)))
  loop
    if exists (
      select 1 from public.smt_production_records r where r.order_line_id = v_remove.id
    ) or exists (
      select 1 from public.smt_production_plans p where p.order_line_id = v_remove.id
    ) then
      raise exception 'LINE_HAS_PRODUCTION:%:%',
        coalesce(nullif(v_remove.product_code, ''), v_remove.id::text),
        coalesce(nullif(v_remove.product_name, ''), '');
    end if;

    if to_regclass('public.production_plan_board_items') is not null
       and exists (
         select 1
         from public.production_plan_board_items b
         where b.order_line_id = v_remove.id
       )
    then
      raise exception 'LINE_HAS_PRODUCTION:%:%',
        coalesce(nullif(v_remove.product_code, ''), v_remove.id::text),
        coalesce(nullif(v_remove.product_name, ''), '');
    end if;
  end loop;

  -- 삭제 허용된 UI 라인 제거 (파생 라인은 derived_from_line_id cascade 또는 아래 정리)
  delete from public.order_lines ol
  where ol.order_id = p_order_id
    and ol.derived_from_line_id is null
    and (cardinality(v_keep_ids) = 0 or not (ol.id = any (v_keep_ids)));

  -- 파생(BOM) 라인은 sync 전에 비움 (부모 id 유지)
  delete from public.order_lines
  where order_id = p_order_id
    and derived_from_line_id is not null;

  -- unique(order_id, line_seq) 충돌 회피
  update public.order_lines ol
  set line_seq = -sub.rn
  from (
    select id, row_number() over (order by line_seq, id) as rn
    from public.order_lines
    where order_id = p_order_id
  ) sub
  where ol.id = sub.id;

  if p_lines is not null and jsonb_typeof(p_lines) = 'array' then
    for v_line in select * from jsonb_array_elements(p_lines)
    loop
      begin
        v_line_id := nullif(trim(v_line ->> 'id'), '')::uuid;
      exception
        when invalid_text_representation then
          v_line_id := null;
      end;

      if v_line_id is not null
         and exists (
           select 1
           from public.order_lines
           where id = v_line_id
             and order_id = p_order_id
             and derived_from_line_id is null
         )
      then
        update public.order_lines
        set
          line_seq = v_seq,
          product_id = nullif(trim(v_line ->> 'product_id'), ''),
          product_code = coalesce(nullif(trim(v_line ->> 'product_code'), ''), ''),
          product_name = coalesce(nullif(trim(v_line ->> 'product_name'), ''), ''),
          quantity = greatest(0, floor(coalesce((v_line ->> 'quantity')::numeric, 0))),
          unit_price = round(coalesce((v_line ->> 'unit_price')::numeric, 0)),
          order_amount = round(coalesce((v_line ->> 'order_amount')::numeric, 0)),
          delivery_date = nullif(trim(v_line ->> 'delivery_date'), '')::date
        where id = v_line_id
          and order_id = p_order_id;
      else
        insert into public.order_lines (
          order_id,
          line_seq,
          product_id,
          product_code,
          product_name,
          quantity,
          unit_price,
          order_amount,
          delivery_date
        ) values (
          p_order_id,
          v_seq,
          nullif(trim(v_line ->> 'product_id'), ''),
          coalesce(nullif(trim(v_line ->> 'product_code'), ''), ''),
          coalesce(nullif(trim(v_line ->> 'product_name'), ''), ''),
          greatest(0, floor(coalesce((v_line ->> 'quantity')::numeric, 0))),
          round(coalesce((v_line ->> 'unit_price')::numeric, 0)),
          round(coalesce((v_line ->> 'order_amount')::numeric, 0)),
          nullif(trim(v_line ->> 'delivery_date'), '')::date
        );
      end if;

      v_seq := v_seq + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'orderId', p_order_id, 'lineCount', v_seq);
end;
$$;

revoke all on function public.save_order_update(text, jsonb, jsonb) from public;
grant execute on function public.save_order_update(text, jsonb, jsonb) to authenticated;

comment on function public.save_order_update(text, jsonb, jsonb) is
  '주문서 수정: 라인 id upsert. 실적·계획이 있는 라인 삭제 금지.';
