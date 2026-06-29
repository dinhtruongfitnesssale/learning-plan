-- ============================================================
-- Bếp Học — cho phép coach DUYỆT yêu cầu học (UPDATE enrollments)
-- Bảng enrollments có select/insert/delete nhưng thiếu update,
-- nên nút "Duyệt" (đổi status -> approved) bị RLS chặn im lặng.
-- Chạy SAU 0004_enroll_categories.sql.
-- ============================================================

create policy enroll_update on public.enrollments for update to authenticated
  using (public.is_coach()) with check (public.is_coach());
