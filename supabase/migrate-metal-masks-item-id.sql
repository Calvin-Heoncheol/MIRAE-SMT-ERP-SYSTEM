-- 메탈마스크에 반제품(item) FK 추가
-- Supabase SQL Editor에서 실행하세요

alter table public.metal_mask_assets
  add column if not exists item_id text references public.items(id) on delete set null;

comment on column public.metal_mask_assets.item_id is '기초등록 반제품 items.id';

create index if not exists metal_mask_assets_item_id_idx
  on public.metal_mask_assets (item_id);
