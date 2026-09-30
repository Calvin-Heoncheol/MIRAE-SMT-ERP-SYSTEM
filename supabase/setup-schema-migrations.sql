-- DB 변경(SQL) 적용 이력
-- 어떤 migrate-*.sql 이 이 DB 에 실행됐는지 기록합니다. 가장 먼저 한 번 실행하세요.
--
-- 확인: select filename, applied_at from public.schema_migrations order by applied_at desc;
-- 예전에 이미 실행한 파일을 수동으로 기록하려면:
--   insert into public.schema_migrations (filename) values ('migrate-xxx.sql') on conflict do nothing;

create table if not exists public.schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);

comment on table public.schema_migrations is 'supabase/*.sql 적용 이력 (파일명 기준)';

alter table public.schema_migrations enable row level security;

drop policy if exists schema_migrations_select_authenticated on public.schema_migrations;
create policy schema_migrations_select_authenticated
  on public.schema_migrations for select
  to authenticated
  using (true);

insert into public.schema_migrations (filename) values ('setup-schema-migrations.sql')
on conflict do nothing;
