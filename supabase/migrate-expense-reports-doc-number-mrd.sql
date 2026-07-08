-- 기존 MER- 문서번호를 MRD- 로 변경 (이미 MRD- 이면 생략 가능)

alter table public.expense_reports drop constraint if exists expense_reports_id_mer_format_check;
alter table public.expense_reports drop constraint if exists expense_reports_doc_number_mer_format_check;
alter table public.expense_reports drop constraint if exists expense_reports_id_mrd_format_check;
alter table public.expense_reports drop constraint if exists expense_reports_doc_number_mrd_format_check;

update public.expense_reports
set
  id = regexp_replace(id, '^MER-', 'MRD-'),
  doc_number = regexp_replace(doc_number, '^MER-', 'MRD-')
where id ~ '^MER-[0-9]+$' or doc_number ~ '^MER-[0-9]+$';

alter table public.expense_reports
  add constraint expense_reports_id_mrd_format_check check (id ~ '^MRD-[0-9]+$');

alter table public.expense_reports
  add constraint expense_reports_doc_number_mrd_format_check check (doc_number ~ '^MRD-[0-9]+$');

create or replace function public.generate_expense_report_code()
returns text
language plpgsql
as $$
declare
  max_num integer;
  next_num integer;
begin
  select coalesce(max(
    nullif(regexp_replace(id, '^MRD-', ''), '')::integer
  ), 0)
  into max_num
  from public.expense_reports
  where id ~ '^MRD-[0-9]+$';

  next_num := max_num + 1;
  return 'MRD-' || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.generate_expense_report_code() to anon, authenticated;
