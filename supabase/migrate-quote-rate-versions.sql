-- Supabase SQL Editor에서 실행하세요
-- 견적 단가표 버전 — 변경할 때마다 새 행을 추가(수정·삭제 없음). 가장 최근 행이 현재 단가표
-- 견적 저장 시 그때의 단가표가 quotations.detail_info.settings.rates 에 함께 저장되므로
-- 단가를 바꿔도 기존 견적 금액은 변하지 않습니다.

create table if not exists public.quote_rate_versions (
  id uuid primary key default gen_random_uuid(),
  rates jsonb not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text not null default ''
);

create index if not exists quote_rate_versions_created_at_idx
  on public.quote_rate_versions (created_at desc);

comment on table public.quote_rate_versions is
  '견적 단가표 버전 이력 — 최신 행이 신규 견적에 적용';

alter table public.quote_rate_versions enable row level security;

drop policy if exists quote_rate_versions_select on public.quote_rate_versions;
create policy quote_rate_versions_select
  on public.quote_rate_versions for select
  using (true);

drop policy if exists quote_rate_versions_insert on public.quote_rate_versions;
create policy quote_rate_versions_insert
  on public.quote_rate_versions for insert
  to authenticated
  with check (true);
