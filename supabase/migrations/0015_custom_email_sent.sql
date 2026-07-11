-- ============================================================
-- Bếp Học — LƯU VẾT ĐÃ GỬI EMAIL TỰ SOẠN (kèm ảnh) cho học viên
--
-- Vấn đề: ở mục "Gửi mail cho học viên" (email tự soạn), coach không
-- nhớ đã gửi cho những ai. Khi có học viên MỚI lại mất thời gian nhớ
-- xem ai đã nhận, ai chưa để gửi bổ sung.
--
-- Khắc phục: mỗi học viên lưu MỐC THỜI GIAN nhận email tự soạn gần
-- nhất. Trống (NULL) = chưa nhận lần nào. Màn soạn mail hiện ngày đã
-- gửi cạnh mỗi người, kèm nút "chọn người chưa nhận".
--
-- Chạy SAU 0014_stable_order.sql.
-- ============================================================

alter table public.profiles
  add column if not exists last_custom_email_at timestamptz;
