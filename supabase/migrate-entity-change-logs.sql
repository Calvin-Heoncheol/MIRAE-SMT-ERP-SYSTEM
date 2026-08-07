-- 엔티티 변경 이력 (주문서·품목·견적서 수정 로그)
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.entity_change_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('order', 'item', 'quote')),
  entity_id text not null,
  title text not null default '',
  detail text not null default '',
  before_data jsonb,
  after_data jsonb,
  changed_by uuid references auth.users (id) on delete set null,
  changed_by_name text not null default '',
  changed_at timestamptz not null default now()
);

comment on table public.entity_change_logs is '주문서·품목·견적서 수정 변경사항 (대시보드 변경사항 피드)';
comment on column public.entity_change_logs.entity_type is 'order | item | quote';
comment on column public.entity_change_logs.entity_id is 'orders.id / items.id / quotations.id';
comment on column public.entity_change_logs.title is '짧은 제목 (예: 주문서 SOO-0001 수정)';
comment on column public.entity_change_logs.detail is '화면용 변경 요약 (품목은 최종 단가+사유 위주)';
comment on column public.entity_change_logs.before_data is '변경 전 스냅샷 (품목: name, unitPrice, smd/dip/materialUnitPrice)';
comment on column public.entity_change_logs.after_data is '변경 후 스냅샷 + reason + priceChanges(어느 단가가 인상/인하인지)';

create index if not exists entity_change_logs_changed_at_idx
  on public.entity_change_logs (changed_at desc);

create index if not exists entity_change_logs_entity_idx
  on public.entity_change_logs (entity_type, entity_id, changed_at desc);

alter table public.entity_change_logs enable row level security;

drop policy if exists "entity_change_logs public read" on public.entity_change_logs;
create policy "entity_change_logs public read"
  on public.entity_change_logs for select using (true);

drop policy if exists "entity_change_logs public insert" on public.entity_change_logs;
create policy "entity_change_logs public insert"
  on public.entity_change_logs for insert with check (true);
