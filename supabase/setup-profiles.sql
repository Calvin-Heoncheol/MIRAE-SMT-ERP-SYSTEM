-- 사용자 프로필 (Supabase Auth 계정과 1:1)
-- 계정 생성: Dashboard → Authentication → Users → Add user
--   User Metadata(JSON) 예시:
--   { "display_name": "홍길동", "role": "operator", "department": "production1" }
-- 공개 회원가입은 Authentication → Providers → Email → Enable sign ups = OFF 권장

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  role text not null default 'operator',
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'ERP 사용자 프로필 — auth.users 와 1:1';
comment on column public.profiles.role is 'admin | manager | operator';
comment on column public.profiles.department is
  'sales | materials | production1 | production2 | production3 | production4 | office';

-- 기존 DB 호환
alter table public.profiles add column if not exists department text;
update public.profiles set role = 'operator' where role = 'user';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'operator'));

alter table public.profiles drop constraint if exists profiles_department_check;
alter table public.profiles
  add constraint profiles_department_check
  check (
    department is null
    or department in (
      'sales',
      'materials',
      'production1',
      'production2',
      'production3',
      'production4',
      'office'
    )
  );

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_department_idx on public.profiles (department);

alter table public.profiles enable row level security;

-- 신규 Auth 사용자 생성 시 프로필 자동 생성
-- User Metadata: display_name (또는 full_name/name), role, department
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text;
begin
  meta_name := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data ->> 'display_name',
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        ''
      )
    ),
    ''
  );

  insert into public.profiles (id, email, display_name, role, department)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(meta_name, split_part(coalesce(new.email, ''), '@', 1)),
    case
      when coalesce(new.raw_user_meta_data ->> 'role', '') in ('admin', 'manager', 'operator')
        then new.raw_user_meta_data ->> 'role'
      else 'operator'
    end,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'department', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 관리자 여부 판정 (RLS 재귀 방지)
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

revoke all on function public.is_profile_admin() from public;
grant execute on function public.is_profile_admin() to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using (public.is_profile_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant select, update on table public.profiles to authenticated;
