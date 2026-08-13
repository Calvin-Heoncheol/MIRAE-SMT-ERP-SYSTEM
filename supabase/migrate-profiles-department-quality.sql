-- profiles.department 에 품질(quality) 부서 추가
-- 기존: sales | materials | production1~4 | office
-- 추가: quality

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
      'quality',
      'office'
    )
  );

comment on column public.profiles.department is
  'sales | materials | production1 | production2 | production3 | production4 | quality | office';
