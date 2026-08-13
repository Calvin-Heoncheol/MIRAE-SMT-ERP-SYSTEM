-- 등록자(로그인 사용자) 추적 — 영업·출하·자재·결재·신규업체·생산계획
-- 실행 후 앱에서 목록「등록자」/작성자 스냅샷이 채워집니다.

do $$
declare
  t text;
begin
  foreach t in array array[
    'orders',
    'quotations',
    'delivery_records',
    'material_purchase_orders',
    'material_inbound_records',
    'material_outbound_records',
    'new_company_inquiries',
    'approvals',
    'leave_requests',
    'expense_reports',
    'smt_production_plans',
    'post_process_production_plans'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists created_by uuid references auth.users (id) on delete set null',
      t
    );
    execute format(
      'alter table public.%I add column if not exists created_by_name text not null default ''''',
      t
    );
    execute format(
      'comment on column public.%I.created_by is %L',
      t,
      '등록자 auth.users.id'
    );
    execute format(
      'comment on column public.%I.created_by_name is %L',
      t,
      '등록자 표시명 스냅샷 (profiles.display_name)'
    );
    execute format(
      'create index if not exists %I on public.%I (created_by)',
      t || '_created_by_idx',
      t
    );
  end loop;
end $$;
