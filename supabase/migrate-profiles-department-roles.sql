-- profiles 역할 확장 + 부서 컬럼
-- role: admin | manager | operator (레거시 user → operator)
-- department: sales | materials | production1~4 | office

alter table public.profiles
  add column if not exists department text;

update public.profiles
set role = 'operator'
where role = 'user';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'operator'));

alter table public.profiles
  drop constraint if exists profiles_department_check;

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

comment on column public.profiles.role is 'admin | manager | operator';
comment on column public.profiles.department is
  'sales | materials | production1 | production2 | production3 | production4 | office';

create index if not exists profiles_department_idx on public.profiles (department);
