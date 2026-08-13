-- Supabase SQL Editor에서 setup-leave-requests.sql 실행 후 이어서 실행하세요
-- 휴가원 첨부파일 Storage 버킷

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leave-request-attachments', 'leave-request-attachments', true, 20971520, null)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "leave request attachments public read" on storage.objects;
create policy "leave request attachments public read"
  on storage.objects for select
  using (bucket_id = 'leave-request-attachments');

drop policy if exists "leave request attachments public insert" on storage.objects;
create policy "leave request attachments public insert"
  on storage.objects for insert
  with check (bucket_id = 'leave-request-attachments');

drop policy if exists "leave request attachments public update" on storage.objects;
create policy "leave request attachments public update"
  on storage.objects for update
  using (bucket_id = 'leave-request-attachments')
  with check (bucket_id = 'leave-request-attachments');

drop policy if exists "leave request attachments public delete" on storage.objects;
create policy "leave request attachments public delete"
  on storage.objects for delete
  using (bucket_id = 'leave-request-attachments');
