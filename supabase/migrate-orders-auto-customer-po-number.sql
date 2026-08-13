-- 신규 주문: 발주번호(customer_po_number) 미입력 시 발주ID(id)와 동일하게 자동 발급
-- Supabase SQL Editor에서 실행하세요.

create or replace function public.normalize_orders_row()
returns trigger
language plpgsql
as $$
begin
  new.customer := coalesce(trim(new.customer), '');
  new.customer_po_number := coalesce(trim(new.customer_po_number), '');
  new.note := coalesce(trim(new.note), '');

  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_order_code(new.order_date);
    end if;
    if new.customer_po_number = '' then
      new.customer_po_number := new.id;
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  return new;
end;
$$;

comment on column public.orders.customer_po_number is
  '발주번호(PO/NO) — 미입력 시 INSERT 때 발주ID(id)와 동일하게 자동 발급, 이후 수정 가능';
