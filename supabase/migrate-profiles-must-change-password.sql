-- 첫 로그인 시 비밀번호 변경 강제 플래그

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'true 이면 로그인 후 새 비밀번호로 변경해야 함 (초기 비밀번호 등)';

-- 신규 Auth 사용자: 기본으로 비밀번호 변경 필요
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

  insert into public.profiles (id, email, display_name, role, department, must_change_password)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(meta_name, split_part(coalesce(new.email, ''), '@', 1)),
    case
      when coalesce(new.raw_user_meta_data ->> 'role', '') in ('admin', 'manager', 'operator')
        then new.raw_user_meta_data ->> 'role'
      else 'operator'
    end,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'department', '')), ''),
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;
