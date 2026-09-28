-- MTO 소프트 예약: 주문×자재 할당 (공용 창고 + 논리 선점)
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.material_order_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  material_id text not null references public.items(id) on delete cascade,
  /** BOM 기준 총 소요 (제품대수 × 단위소요 합) */
  required_qty numeric not null default 0 check (required_qty >= 0),
  /** 현재고에서 이 주문에 소프트 예약한 수량 (미불출 선점) */
  reserved_qty numeric not null default 0 check (reserved_qty >= 0),
  /** 이미 생산 불출된 수량 */
  issued_qty numeric not null default 0 check (issued_qty >= 0),
  updated_at timestamptz not null default now(),
  constraint material_order_allocations_order_material_key unique (order_id, material_id)
);

create index if not exists material_order_allocations_material_idx
  on public.material_order_allocations (material_id);

create index if not exists material_order_allocations_order_idx
  on public.material_order_allocations (order_id);

comment on table public.material_order_allocations is
  'MTO 소프트 예약 — 주문별 자재 소요/예약/불출. 릴 하드 pegging 아님.';

comment on column public.material_order_allocations.reserved_qty is
  '공용 현재고에서 이 주문이 선점한 수량 (issued 제외 잔여 예약)';

comment on column public.material_order_allocations.issued_qty is
  '이 주문으로 이미 불출된 누적 수량';

comment on column public.material_order_allocations.required_qty is
  '주문 BOM 전개 총 소요';

grant select, insert, update, delete on public.material_order_allocations to anon, authenticated;
