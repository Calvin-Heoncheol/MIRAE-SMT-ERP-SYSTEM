-- 품목 유니크: 품목코드 + 품명 + 버전
-- 같은 품목코드·버전이라도 품목명이 다르면 등록 가능
-- Supabase SQL Editor에서 실행 (멱등)

-- 예전 유니크(품목코드+버전) 인덱스/제약 제거
drop index if exists public.items_base_code_version_uidx;
drop index if exists public.items_base_code_version_key;

alter table public.items drop constraint if exists items_base_code_version_uidx;
alter table public.items drop constraint if exists items_base_code_version_key;

do $$
declare
  rec record;
begin
  for rec in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'items'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ~* 'base_code'
      and pg_get_constraintdef(c.oid) ~* 'version'
      and pg_get_constraintdef(c.oid) !~* '\mname\M'
  loop
    execute format('alter table public.items drop constraint if exists %I', rec.conname);
  end loop;

  for rec in
    select i.relname as index_name
    from pg_index x
    join pg_class t on t.oid = x.indrelid
    join pg_class i on i.oid = x.indexrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'items'
      and x.indisunique
      and not x.indisprimary
      and pg_get_indexdef(i.oid) ~* 'base_code'
      and pg_get_indexdef(i.oid) ~* 'version'
      and pg_get_indexdef(i.oid) !~* '\mname\M'
      and pg_get_indexdef(i.oid) !~* 'item_category'
  loop
    execute format('drop index if exists public.%I', rec.index_name);
  end loop;
end $$;

drop index if exists public.items_base_code_name_version_uidx;

create unique index if not exists items_base_code_name_version_uidx
  on public.items (
    lower(btrim(base_code)),
    lower(btrim(name)),
    lower(btrim(version))
  );

comment on index public.items_base_code_name_version_uidx is
  '같은 품목코드·품명·버전 조합만 중복 금지. 코드·버전이 같아도 품목명이 다르면 허용';
