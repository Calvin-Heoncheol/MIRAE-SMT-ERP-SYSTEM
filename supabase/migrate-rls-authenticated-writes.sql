-- =============================================================================
-- RLS: anon 공개 쓰기 제거 → 로그인(authenticated) 필수
-- =============================================================================
-- 적용 전제
--   1) setup-profiles.sql / migrate-profiles-rls-fix.sql 적용됨
--   2) 앱 AUTH_ENABLED=true (로그인 세션 JWT 필요)
--   3) 앱 createSupabaseClient 가 브라우저에서 세션을 포함함 (최신 코드)
--
-- 정책 요약
--   · SELECT: 기존과 같이 공개(RSC anon 조회 호환)
--   · INSERT/UPDATE: 로그인 사용자
--   · DELETE: 팀장(manager) 이상
--   · 기초등록(items / business_partners / bom_items): 관리자(admin)만 쓰기
--
-- Supabase SQL Editor에서 한 번 실행하세요. 없는 테이블은 건너뜁니다.
-- 상세: supabase/SECURITY.md
-- =============================================================================

create or replace function public.is_profile_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_profile_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager')
  );
$$;

revoke all on function public.is_profile_admin() from public;
revoke all on function public.is_profile_manager_or_admin() from public;
grant execute on function public.is_profile_admin() to authenticated;
grant execute on function public.is_profile_manager_or_admin() to authenticated;

create or replace function public._erp_reset_table_rls(p_table text, p_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pol record;
begin
  if to_regclass('public.' || p_table) is null then
    raise notice 'skip missing table: %', p_table;
    return;
  end if;

  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = p_table
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, p_table);
  end loop;

  execute format('alter table public.%I enable row level security', p_table);

  execute format(
    'create policy %I on public.%I for select using (true)',
    p_table || '_select_all',
    p_table
  );

  if p_mode = 'master' then
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_profile_admin())',
      p_table || '_insert_admin',
      p_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_profile_admin()) with check (public.is_profile_admin())',
      p_table || '_update_admin',
      p_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_profile_admin())',
      p_table || '_delete_admin',
      p_table
    );
  elsif p_mode = 'ops' then
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (auth.uid() is not null)',
      p_table || '_insert_auth',
      p_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)',
      p_table || '_update_auth',
      p_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_profile_manager_or_admin())',
      p_table || '_delete_manager',
      p_table
    );
  end if;
end;
$$;

-- 기초등록 (admin만 쓰기)
select public._erp_reset_table_rls('items', 'master');
select public._erp_reset_table_rls('business_partners', 'master');
select public._erp_reset_table_rls('bom_items', 'master');

-- 업무 테이블 (로그인 쓰기 / 팀장 이상 삭제)
select public._erp_reset_table_rls('orders', 'ops');
select public._erp_reset_table_rls('order_lines', 'ops');
select public._erp_reset_table_rls('order_assembly_groups', 'ops');
select public._erp_reset_table_rls('order_assembly_group_lines', 'ops');
select public._erp_reset_table_rls('quotations', 'ops');
select public._erp_reset_table_rls('new_company_inquiries', 'ops');
select public._erp_reset_table_rls('delivery_records', 'ops');
select public._erp_reset_table_rls('material_purchase_orders', 'ops');
select public._erp_reset_table_rls('material_purchase_order_lines', 'ops');
select public._erp_reset_table_rls('material_purchase_need_deleted_orders', 'ops');
select public._erp_reset_table_rls('material_inbound_records', 'ops');
select public._erp_reset_table_rls('material_inbound_lines', 'ops');
select public._erp_reset_table_rls('material_outbound_records', 'ops');
select public._erp_reset_table_rls('material_outbound_lines', 'ops');
select public._erp_reset_table_rls('smt_production_records', 'ops');
select public._erp_reset_table_rls('smt_production_plans', 'ops');
select public._erp_reset_table_rls('post_process_production_records', 'ops');
select public._erp_reset_table_rls('post_process_production_plans', 'ops');
select public._erp_reset_table_rls('production_plan_close_logs', 'ops');
select public._erp_reset_table_rls('metal_mask_assets', 'ops');
select public._erp_reset_table_rls('metal_mask_usage_logs', 'ops');
select public._erp_reset_table_rls('squeegee_assets', 'ops');
select public._erp_reset_table_rls('squeegee_usage_logs', 'ops');
select public._erp_reset_table_rls('approvals', 'ops');
select public._erp_reset_table_rls('expense_reports', 'ops');
select public._erp_reset_table_rls('leave_requests', 'ops');

drop function if exists public._erp_reset_table_rls(text, text);

comment on function public.is_profile_manager_or_admin() is
  'RLS용 — profiles.role 이 admin 또는 manager';
