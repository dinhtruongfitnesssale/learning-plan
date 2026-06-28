-- ============================================================
-- Bếp Học — bổ sung media cho bài học (video link + PDF upload)
-- Chạy SAU 0001_init.sql.
-- ============================================================

-- Cột media trên lessons
alter table public.lessons
  add column if not exists video_url text not null default '',
  add column if not exists pdf_url  text not null default '',
  add column if not exists pdf_name text not null default '';

-- ---------- Storage bucket cho tài liệu PDF ----------
-- public = true để học viên xem/tải qua URL công khai (đường dẫn ngẫu nhiên, khó đoán).
insert into storage.buckets (id, name, public)
values ('lesson-files', 'lesson-files', true)
on conflict (id) do nothing;

-- Đọc: mọi người đã đăng nhập (và link công khai cho phép xem trực tiếp).
drop policy if exists "lesson_files_read" on storage.objects;
create policy "lesson_files_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'lesson-files');

-- Ghi/sửa/xóa: chỉ coach.
drop policy if exists "lesson_files_insert" on storage.objects;
create policy "lesson_files_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'lesson-files' and public.is_coach());

drop policy if exists "lesson_files_update" on storage.objects;
create policy "lesson_files_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'lesson-files' and public.is_coach());

drop policy if exists "lesson_files_delete" on storage.objects;
create policy "lesson_files_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'lesson-files' and public.is_coach());
