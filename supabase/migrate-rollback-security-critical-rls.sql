-- =============================================================================
-- Critical RLS 롤백 (migrate-security-critical-rls.sql 되돌리기)
-- =============================================================================
-- 복구 내용
--   · SELECT: 다시 공개 (using true) — 앱 RSC anon 조회 호환 (85b9939 코드와 맞춤)
--   · INSERT/UPDATE/DELETE: 로그인 필수 정책 유지 (기존 harden)
--   · profiles: trg_enforce_profile_safe_update 트리거·함수 제거
--   · entity_change_logs: public select/insert 정책 복구
--
-- Supabase SQL Editor에서 한 번 실행하세요.
-- =============================================================================

-- ── profiles 승격 차단 트리거 제거 ───────────────────────────────────────────
drop trigger if exists trg_enforce_profile_safe_update on public.profiles;
drop function if exists public.enforce_profile_safe_update();

-- ── RLS helpers ──────────────────────────────────────────────────────────────
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

  -- SELECT 공개 (Critical 이전과 동일)
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

-- 기초등록
select public._erp_reset_table_rls('items', 'master');
select public._erp_reset_table_rls('business_partners', 'master');
select public._erp_reset_table_rls('bom_items', 'master');

-- 업무 테이블
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

-- ── entity_change_logs: Critical 이전 public 정책 복구 ───────────────────────
do $$
begin
  if to_regclass('public.entity_change_logs') is null then
    raise notice 'skip missing table: entity_change_logs';
    return;
  end if;

  alter table public.entity_change_logs enable row level security;

  drop policy if exists entity_change_logs_select_auth on public.entity_change_logs;
  drop policy if exists entity_change_logs_insert_auth on public.entity_change_logs;
  drop policy if exists "entity_change_logs public read" on public.entity_change_logs;
  drop policy if exists "entity_change_logs public insert" on public.entity_change_logs;

  create policy "entity_change_logs public read"
    on public.entity_change_logs for select using (true);

  create policy "entity_change_logs public insert"
    on public.entity_change_logs for insert with check (true);
end $$;

-- 확인용 (선택): 실행 후 Results에 트리거 없어야 정상
-- select tgname from pg_trigger
-- where tgrelid = 'public.profiles'::regclass and not tgisinternal;
