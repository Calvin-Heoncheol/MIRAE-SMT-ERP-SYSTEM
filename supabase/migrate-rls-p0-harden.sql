-- =============================================================================
-- P0 RLS 보강: harden 누락 테이블 + profiles role/department 잠금
-- =============================================================================
-- 적용 전제
--   1) setup-profiles.sql (또는 migrate-profiles-rls-fix.sql)
--   2) migrate-rls-authenticated-writes.sql (권장, 없어도 헬퍼를 다시 만듦)
--   3) AUTH_ENABLED=true
--
-- 이 파일은
--   · statement_payments / production_lots / delivery_record_lots /
--     production_plan_board_items / solder_cream_* / quality 등 누락 테이블 쓰기 harden
--   · profiles: 본인이 role·department 를 올리지 못하게 트리거
-- SELECT 는 RSC anon 호환을 위해 using(true) 유지 (SECURITY.md 동일).
--
-- Supabase SQL Editor에서 한 번 실행하세요.
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

  -- SELECT 공개 (RSC anon)
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

-- ── 누락 업무 테이블 (로그인 쓰기 / 팀장 이상 삭제) ──────────────────────────
select public._erp_reset_table_rls('statement_payments', 'ops');
select public._erp_reset_table_rls('production_lots', 'ops');
select public._erp_reset_table_rls('delivery_record_lots', 'ops');
select public._erp_reset_table_rls('production_plan_board_items', 'ops');
select public._erp_reset_table_rls('solder_cream_lot_status', 'ops');
select public._erp_reset_table_rls('solder_cream_log_imports', 'ops');
select public._erp_reset_table_rls('solder_cream_equipment_logs', 'ops');
select public._erp_reset_table_rls('production_unit_labels', 'ops');
select public._erp_reset_table_rls('quality_defect_handlings', 'ops');
select public._erp_reset_table_rls('production_plan_close_logs', 'ops');

-- 변경이력: INSERT 만 authenticated (SELECT 공개 유지)
do $$
begin
  if to_regclass('public.entity_change_logs') is null then
    raise notice 'skip missing table: entity_change_logs';
    return;
  end if;

  alter table public.entity_change_logs enable row level security;

  drop policy if exists "entity_change_logs public insert" on public.entity_change_logs;
  drop policy if exists entity_change_logs_insert_auth on public.entity_change_logs;
  drop policy if exists "entity_change_logs public read" on public.entity_change_logs;
  drop policy if exists entity_change_logs_select_auth on public.entity_change_logs;
  drop policy if exists entity_change_logs_select_all on public.entity_change_logs;

  create policy "entity_change_logs public read"
    on public.entity_change_logs for select using (true);

  create policy entity_change_logs_insert_auth
    on public.entity_change_logs
    for insert
    to authenticated
    with check (auth.uid() is not null);
end $$;

drop function if exists public._erp_reset_table_rls(text, text);

-- ── profiles: 본인 role / department 승격·변경 차단 ─────────────────────────
create or replace function public.enforce_profile_safe_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  -- service_role(Admin API) 또는 관리자 프로필은 전부 허용
  if v_jwt_role = 'service_role' or public.is_profile_admin() then
    return NEW;
  end if;

  if NEW.role is distinct from OLD.role then
    raise exception 'PROFILE_ROLE_LOCKED'
      using errcode = '42501',
            hint = '역할은 관리자만 변경할 수 있습니다.';
  end if;

  if NEW.department is distinct from OLD.department then
    raise exception 'PROFILE_DEPARTMENT_LOCKED'
      using errcode = '42501',
            hint = '부서는 관리자만 변경할 수 있습니다.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_profile_safe_update on public.profiles;
create trigger trg_enforce_profile_safe_update
  before update on public.profiles
  for each row
  execute function public.enforce_profile_safe_update();

comment on function public.enforce_profile_safe_update() is
  'profiles: 비관리자 본인이 role/department 를 바꾸지 못하게 함 (service_role·admin 제외)';
