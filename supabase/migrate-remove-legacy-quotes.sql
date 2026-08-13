-- (구) 견적서 데이터 제거

delete from public.quotations
where coalesce(detail_info->'settings'->>'quoteType', '') = 'legacy';
