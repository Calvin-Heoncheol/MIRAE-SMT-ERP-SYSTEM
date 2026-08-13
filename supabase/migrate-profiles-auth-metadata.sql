-- Auth Add user 시 User Metadata 로 display_name / role / department 반영
-- Dashboard → Authentication → Users → Add user → User Metadata(JSON):
--   { "display_name": "홍길동", "role": "operator", "department": "production1" }

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

comment on function public.handle_new_user() is
  'auth.users 생성 시 profiles 자동 생성. raw_user_meta_data.display_name / role / department 반영';
