-- ============================================================
-- Bếp Học — công tắc cho phép học viên tải tài liệu về (theo từng bài)
-- Chạy SAU 0002_media.sql.
-- ============================================================

alter table public.lessons
  add column if not exists allow_download boolean not null default true;
