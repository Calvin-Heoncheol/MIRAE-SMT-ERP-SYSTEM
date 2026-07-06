-- 품의코드·문서번호를 MRA-0001 형식으로 통일
-- Supabase SQL Editor에서 실행하세요.

drop function if exists public.generate_approval_doc_number() cascade;
drop function if exists public.generate_approval_doc_number(date) cascade;
drop function if exists public.generate_approval_doc_number(date, text) cascade;
drop function if exists public.generate_approval_doc_prefix(text) cascade;

create or replace function public.generate_approval_code()
returns text
language plpgsql
as $$
declare
  max_num integer;
  next_num integer;
begin
  select coalesce(max(
    nullif(regexp_replace(id, '^MRA-', ''), '')::integer
  ), 0)
  into max_num
  from public.approvals
  where id ~ '^MRA-[0-9]+$';

  next_num := max_num + 1;
  return 'MRA-' || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.generate_approval_code() to anon, authenticated;

alter table public.approvals
  drop constraint if exists approvals_id_apr_format_check;

alter table public.approvals
  drop constraint if exists approvals_id_mra_format_check;

alter table public.approvals
  drop constraint if exists approvals_doc_number_mra_format_check;

-- 기존 APR·부서형 문서번호를 생성 순서대로 MRA-0001로 일괄 변환
with numbered as (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.approvals
)
update public.approvals a
set
  id = 'MRA-' || lpad(n.rn::text, 4, '0'),
  doc_number = 'MRA-' || lpad(n.rn::text, 4, '0')
from numbered n
where a.id = n.id;

alter table public.approvals
  add constraint approvals_id_mra_format_check
  check (id ~ '^MRA-[0-9]+$');

alter table public.approvals
  add constraint approvals_doc_number_mra_format_check
  check (doc_number ~ '^MRA-[0-9]+$');

create or replace function public.normalize_approvals_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_approval_code();
    end if;
    if new.doc_number is null or trim(new.doc_number) = '' then
      new.doc_number := new.id;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      new.id := old.id;
    end if;
    if new.doc_number is null or trim(new.doc_number) = '' then
      new.doc_number := old.doc_number;
    end if;
  end if;

  new.department := coalesce(trim(new.department), '관리부');
  new.author := coalesce(trim(new.author), '');
  new.subject := coalesce(trim(new.subject), '');
  new.intro_body := coalesce(trim(new.intro_body), '');
  return new;
end;
$$;

comment on table public.approvals is '품의서 마스터 — 품의코드·문서번호 MRA-0001';
comment on column public.approvals.id is '품의코드 MRA-0001 (INSERT 시 자동 발급, 수정 불가)';
comment on column public.approvals.doc_number is '문서번호 MRA-0001 (id와 동일, INSERT 시 자동 발급)';
