-- ============================================================
-- Bếp Học — ĐÁNH GIÁ KHÓA HỌC (học viên đánh giá sau khi học xong)
--
-- Mỗi học viên đánh giá 1 lần / khóa (sửa lại được). Chấm 5 tiêu chí
-- theo thang 1–5 sao + lời góp ý tự do. Coach đọc toàn bộ đánh giá.
--
-- Chạy SAU 0010_require_quiz_pass.sql.
-- ============================================================

create table if not exists public.course_reviews (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles on delete cascade,
  course_id        uuid not null references public.courses  on delete cascade,
  -- 5 tiêu chí, thang 1–5 sao.
  r_content        int  not null check (r_content        between 1 and 5), -- Nội dung khóa học
  r_coach          int  not null check (r_coach          between 1 and 5), -- Hướng dẫn của HLV
  r_difficulty     int  not null check (r_difficulty     between 1 and 5), -- Độ khó phù hợp
  r_applicability  int  not null check (r_applicability  between 1 and 5), -- Áp dụng thực tế
  r_overall        int  not null check (r_overall        between 1 and 5), -- Hài lòng chung
  comment          text not null default '',                              -- Cảm nhận / góp ý
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists idx_reviews_course on public.course_reviews(course_id);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.course_reviews enable row level security;

-- Đọc: đánh giá của mình / coach đọc tất.
drop policy if exists reviews_select on public.course_reviews;
create policy reviews_select on public.course_reviews for select to authenticated
  using (user_id = auth.uid() or public.is_coach());

-- Thêm: chỉ đánh giá của chính mình VÀ phải đang được ghi danh khóa đó.
drop policy if exists reviews_insert on public.course_reviews;
create policy reviews_insert on public.course_reviews for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.enrollments e
      where e.user_id = auth.uid()
        and e.course_id = course_reviews.course_id
        and e.status = 'approved'
    )
  );

-- Sửa: chỉ đánh giá của chính mình.
drop policy if exists reviews_update on public.course_reviews;
create policy reviews_update on public.course_reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
