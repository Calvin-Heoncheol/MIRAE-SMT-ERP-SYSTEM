-- 출하번호: MRS-0001 순번 → MRS-YYMMDD-NN (출하일 기준 당일 순번)
-- 예: MRS-260811-01
-- 기존 MRS-0016 등은 유지 (형식 CHECK 둘 다 허용)
-- Supabase SQL Editor에서 실행하세요.

alter table public.delivery_records
  drop constraint if exists delivery_records_id_mrs_format_check;

alter table public.delivery_records
  add constraint delivery_records_id_mrs_format_check
  check (
    id ~ '^MRS-[0-9]+$'
    or id ~ '^MRS-[0-9]{6}-[0-9]{2}$'
  );

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

comment on function public.generate_delivery_number(date) is
  '출하번호 자동 발급 — MRS-YYMMDD-NN (출하일 기준 당일 순번)';

comment on column public.delivery_records.id is
  '출하 라인번호 MRS-YYMMDD-NN (INSERT 시 자동 발급). 구형식 MRS-0001 호환';

comment on column public.delivery_records.shipment_id is
  '거래명세서 묶음번호 — 보통 같은 출하의 첫 라인 id (MRS-YYMMDD-NN)';
