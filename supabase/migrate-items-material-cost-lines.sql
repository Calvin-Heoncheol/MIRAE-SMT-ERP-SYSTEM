-- 품목 자재비 세부 행 (거래명세서 분할용)
-- [{ "label": "PCB 자재비", "unitPrice": 1000 }, ...]
-- 비어 있으면 material_unit_price 단일 자재비만 사용

alter table public.items
  add column if not exists material_cost_lines jsonb not null default '[]'::jsonb;

comment on column public.items.material_cost_lines is
  '자재비 세부 행 JSON 배열 [{label, unitPrice}]. 2개 이상이면 발주 시 금액전용 행으로 분할';

alter table public.items
  drop constraint if exists items_material_cost_lines_is_array;

alter table public.items
  add constraint items_material_cost_lines_is_array
  check (jsonb_typeof(material_cost_lines) = 'array');
