-- ============================================================
-- Bếp Học — LOẠI KHÓA HỌC tự thêm được (thay vì cố định 2 loại)
--
-- - Bảng course_categories do coach quản lý (thêm/xóa loại bất kỳ).
-- - courses.category vẫn là text (slug của loại); bỏ ràng buộc cứng.
--
-- Chạy SAU 0007_chapter_quiz.sql.
-- ============================================================

create table if not exists public.course_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  emoji      text not null default '',
  accent     text not null default 'amber'
             check (accent in ('amber', 'herb', 'slate', 'clay')),
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

-- Giữ lại 2 loại sẵn có.
insert into public.course_categories (slug, label, emoji, accent, sort_order)
values
  ('dinh_duong', 'Dinh dưỡng', '🍲', 'amber', 0),
  ('tap_luyen',  'Tập luyện',  '🏃', 'herb',  1)
on conflict (slug) do nothing;

-- Bỏ ràng buộc cứng để courses.category nhận loại bất kỳ.
alter table public.courses drop constraint if exists courses_category_check;

-- RLS: ai đăng nhập cũng đọc được; chỉ coach được sửa.
alter table public.course_categories enable row level security;
drop policy if exists cat_select on public.course_categories;
create policy cat_select on public.course_categories
  for select to authenticated using (true);
drop policy if exists cat_write on public.course_categories;
create policy cat_write on public.course_categories
  for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
