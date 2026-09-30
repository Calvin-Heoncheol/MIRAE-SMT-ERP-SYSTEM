-- 출하번호 MRS-YYMMDD-NN: 하루 100건째(-100)부터도 발급되도록 자릿수 확장 + 동시 등록 시 번호 충돌 방지
-- 기존 번호(MRS-260811-01, MRS-0016)는 그대로 유효합니다.
-- Supabase SQL Editor에서 실행하세요.

alter table public.delivery_records
  drop constraint if exists delivery_records_id_mrs_format_check;

alter table public.delivery_records
  add constraint delivery_records_id_mrs_format_check
  check (
    id ~ '^MRS-[0-9]+$'
    or id ~ '^MRS-[0-9]{6}-[0-9]{2,}$'
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
begin
  d := coalesce(p_record_date, (timezone('Asia/Seoul', now()))::date);
  prefix := 'MRS-' || to_char(d, 'YYMMDD');

  -- 같은 날짜 번호 발급을 트랜잭션 끝까지 직렬화 (동시 등록 시 같은 번호 방지)
  perform pg_advisory_xact_lock(hashtext('generate_delivery_number:' || prefix));

  select coalesce(max(substring(id from length(prefix) + 2)::integer), 0)
    into max_suffix
  from public.delivery_records
  where id ~ ('^' || prefix || '-[0-9]{2,}$');

  return prefix || '-' || lpad((max_suffix + 1)::text, 2, '0');
end;
$$;

comment on function public.generate_delivery_number(date) is
  '출하번호 자동 발급 — MRS-YYMMDD-NN (출하일 기준 당일 순번, 100건 이상은 3자리)';

grant execute on function public.generate_delivery_number(date) to anon, authenticated;

-- 적용 이력 기록 (setup-schema-migrations.sql 실행 후에만 기록됨)
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    insert into public.schema_migrations (filename) values ('migrate-delivery-number-3digit-lock.sql') on conflict do nothing;
  end if;
end $$;
