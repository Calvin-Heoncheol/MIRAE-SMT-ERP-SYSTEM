-- Supabase SQL Editor에서 실행하세요
-- 자재 발주번호 형식 MSPYYMMDD → MRP-YYMMDD 로 변경 (기존 DB용)

alter table public.material_purchase_orders
  drop constraint if exists material_purchase_orders_id_format_check;

alter table public.material_purchase_orders
  add constraint material_purchase_orders_id_format_check
  check (id ~ '^MRP-[0-9]{6}([0-9]{2})?$');

comment on table public.material_purchase_orders is '자재 발주 마스터 — 발주번호=id(MRP-260707)';
comment on column public.material_purchase_orders.id is '발주번호 MRP-YYMMDD (INSERT 시 자동 발급, 수정 불가)';

create or replace function public.generate_material_purchase_order_code()
returns text
language plpgsql
as $$
declare
  seoul_date date;
  year_short text;
  month2 text;
  day2 text;
  prefix text;
  has_base boolean := false;
  max_suffix integer := 0;
  row_id text;
  suffix_text text;
  suffix_num integer;
begin
  seoul_date := (timezone('Asia/Seoul', now()))::date;
  year_short := to_char(seoul_date, 'YY');
  month2 := to_char(seoul_date, 'MM');
  day2 := to_char(seoul_date, 'DD');
  prefix := 'MRP-' || year_short || month2 || day2;

  for row_id in
    select id
    from public.material_purchase_orders
    where order_date = seoul_date
  loop
    if row_id = prefix then
      has_base := true;
    elsif row_id ~ ('^' || prefix || '[0-9]{2}$') then
      suffix_text := substring(row_id from length(prefix) + 1 for 2);
      suffix_num := suffix_text::integer;
      if suffix_num > max_suffix then
        max_suffix := suffix_num;
      end if;
    end if;
  end loop;

  if not has_base and max_suffix = 0 then
    return prefix;
  end if;

  return prefix || lpad((max_suffix + 1)::text, 2, '0');
end;
$$;

grant execute on function public.generate_material_purchase_order_code() to anon, authenticated;
