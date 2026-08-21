-- 솔더크림 LOT 수동 상태(폐기 등). Supabase SQL Editor에서 실행하세요.

create table if not exists public.solder_cream_lot_status (
  lot_number text primary key,
  status text not null
    check (status in ('cold', 'discarded', 'scrapped')),
  note text not null default '',
  updated_at timestamptz not null default now()
);

comment on table public.solder_cream_lot_status is '솔더크림 LOT 수동 상태 오버라이드 (폐기 등)';
comment on column public.solder_cream_lot_status.status is 'cold=냉장보관중, discarded=출고, scrapped=폐기';

alter table public.solder_cream_lot_status enable row level security;

drop policy if exists "solder_cream_lot_status public read" on public.solder_cream_lot_status;
create policy "solder_cream_lot_status public read"
  on public.solder_cream_lot_status for select using (true);

drop policy if exists "solder_cream_lot_status public write" on public.solder_cream_lot_status;
create policy "solder_cream_lot_status public write"
  on public.solder_cream_lot_status for all using (true) with check (true);
