-- ============================================================
-- Bếp Học — cho HỌC VIÊN thấy có quiz hay không
--
-- Bảng quizzes trước đây chỉ coach đọc được, nên học viên không thấy
-- nút/quiz nào (hasQuiz luôn false, không có card quiz chương, gating
-- không chạy). Bảng quizzes KHÔNG chứa đáp án (đáp án nằm ở
-- quiz_questions — vẫn chỉ coach, học viên lấy qua RPC get_quiz), nên
-- cho mọi người đăng nhập đọc metadata quiz là an toàn.
--
-- Chạy SAU 0008_course_categories.sql.
-- ============================================================

drop policy if exists quizzes_select on public.quizzes;
create policy quizzes_select on public.quizzes
  for select to authenticated using (true);
