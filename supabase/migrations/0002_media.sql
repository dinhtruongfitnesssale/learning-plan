-- ============================================================
-- Bếp Học — bổ sung media cho bài học (video & PDF nhúng theo link)
-- Chạy SAU 0001_init.sql.
-- ============================================================

-- Cột media trên lessons. Video & PDF đều lưu LINK (YouTube / Google Drive...),
-- không upload file lên Supabase để tiết kiệm dữ liệu.
alter table public.lessons
  add column if not exists video_url text not null default '',
  add column if not exists pdf_url  text not null default '',
  add column if not exists pdf_name text not null default '';
