-- 발주번호 형식 마이그레이션
-- 허용: MRP-YYMMDD-NN (신규, 예: MRP-260722-01)
--       MRP-YYMMDD     (구형식)
--       MRP-YYMMDDNN   (구형식)
-- Supabase SQL Editor에서 이 파일 전체를 한 번에 실행하세요.

alter table public.material_purchase_orders drop constraint if exists material_purchase_orders_id_format_check;

alter table public.material_purchase_orders add constraint material_purchase_orders_id_format_check check ((length(id) = 13 and id like 'MRP-______-__') or (length(id) = 10 and id like 'MRP-______') or (length(id) = 12 and id like 'MRP-________'));

create or replace function public.generate_material_purchase_order_code()
returns text
language plpgsql
as $fn$
declare
  seoul_date date;
  year_short text;
  month2 text;
  day2 text;
  prefix text;
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
    where id like prefix || '%'
       or order_date = seoul_date
  loop
    if length(row_id) = length(prefix) + 3 and row_id like prefix || '-__' then
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
    elsif row_id = prefix then
      if max_suffix < 1 then
        max_suffix := 1;
      end if;
    elsif length(row_id) = length(prefix) + 2 and row_id like prefix || '__' then
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
$fn$;

comment on column public.material_purchase_orders.id is
  '발주번호 MRP-YYMMDD-NN (INSERT 시 자동 발급, 수정 불가)';
