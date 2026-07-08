-- Supabase SQL Editor에서 setup-expense-reports.sql 실행 후 이어서 실행하세요
-- 지출결의서 첨부파일 Storage 버킷

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-report-attachments', 'expense-report-attachments', true, 20971520, null)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "expense report attachments public read" on storage.objects;
create policy "expense report attachments public read"
  on storage.objects for select
  using (bucket_id = 'expense-report-attachments');

drop policy if exists "expense report attachments public insert" on storage.objects;
create policy "expense report attachments public insert"
  on storage.objects for insert
  with check (bucket_id = 'expense-report-attachments');

drop policy if exists "expense report attachments public update" on storage.objects;
create policy "expense report attachments public update"
  on storage.objects for update
  using (bucket_id = 'expense-report-attachments')
  with check (bucket_id = 'expense-report-attachments');

drop policy if exists "expense report attachments public delete" on storage.objects;
create policy "expense report attachments public delete"
  on storage.objects for delete
  using (bucket_id = 'expense-report-attachments');
