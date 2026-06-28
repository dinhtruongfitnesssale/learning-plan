-- ============================================================
-- Bếp Học — dữ liệu mẫu (chạy SAU 0001_init.sql, không bắt buộc).
-- Tạo 1 khóa dinh dưỡng đã publish để xem app chạy ngay.
-- ============================================================

insert into public.courses (id, title, slug, summary, cover_emoji, accent, sort_order, published)
values
  ('11111111-1111-1111-1111-111111111111',
   'Dinh dưỡng nền tảng', 'dinh-duong-nen-tang',
   'Hiểu mâm cơm của bạn: năng lượng, đạm, và cách ăn no mà vẫn gọn dáng.',
   '🍲', 'amber', 1, true),
  ('22222222-2222-2222-2222-222222222222',
   'Tập luyện cho người mới', 'tap-luyen-co-ban',
   'Bắt đầu vận động đúng cách: khởi động, động tác nền, và đều đặn hơn nhanh.',
   '🏃', 'herb', 2, true)
on conflict (id) do nothing;

insert into public.modules (id, course_id, title, sort_order) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bắt đầu từ mâm cơm', 1),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Đạm & no lâu', 2)
on conflict (id) do nothing;

insert into public.lessons (id, course_id, module_id, title, slug, summary, content, est_minutes, xp_reward, sort_order) values
  ('bbbbbbbb-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Calo là gì và vì sao quan trọng', 'calo-la-gi',
   'Năng lượng vào – ra quyết định cân nặng, không phải "ăn kiêng khắc nghiệt".',
   E'## Calo — đơn vị năng lượng\n\nMỗi món trên mâm cơm mang một lượng **năng lượng** đo bằng *kcalo* (kcal).\n\n- Cơ thể tiêu calo để thở, đi lại, tập luyện.\n- Ăn vào nhiều hơn tiêu → tích mỡ. Ít hơn → giảm mỡ.\n\n> Không cần nhịn đói. Cần hiểu **cán cân**: vào và ra.\n\n### 3 nhóm sinh năng lượng\n1. Tinh bột (cơm, bún) — 4 kcal/g\n2. Đạm (thịt, cá, đậu) — 4 kcal/g\n3. Béo (dầu, mỡ) — 9 kcal/g\n\nGhi nhớ: béo đậm năng lượng gấp đôi, nên để mắt tới lượng dầu mỡ.',
   4, 20, 1),
  ('bbbbbbbb-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002',
   'Đạm: ăn no mà vẫn gọn', 'dam-an-no',
   'Đạm giúp no lâu và giữ cơ khi giảm cân.',
   E'## Vì sao cần đủ đạm\n\nĐạm (protein) là nguyên liệu xây cơ và giúp bạn **no lâu hơn** tinh bột.\n\n- Mỗi bữa nên có một phần đạm bằng lòng bàn tay.\n- Nguồn Việt quen thuộc: thịt nạc, cá, trứng, đậu phụ, tôm.\n\n### Mẹo mâm cơm\n- Thêm trứng/đậu vào bữa sáng.\n- Ưu tiên luộc, hấp hơn chiên ngập dầu.\n\n> Ăn đủ đạm = bớt thèm vặt buổi chiều.',
   5, 25, 2)
on conflict (id) do nothing;

-- Quiz cho bài 1
insert into public.quizzes (id, lesson_id, title, pass_score, xp_reward) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'Kiểm tra: Calo', 70, 30)
on conflict (id) do nothing;

insert into public.quiz_questions (quiz_id, prompt, options, correct_index, explanation, sort_order) values
  ('cccccccc-0000-0000-0000-000000000001',
   '1 gam chất béo cung cấp khoảng bao nhiêu kcal?',
   '["4 kcal","9 kcal","2 kcal","0 kcal"]'::jsonb, 1,
   'Béo cho 9 kcal/g — gấp đôi tinh bột và đạm.', 1),
  ('cccccccc-0000-0000-0000-000000000001',
   'Muốn giảm mỡ, cán cân năng lượng cần như thế nào?',
   '["Ăn vào nhiều hơn tiêu","Ăn vào bằng tiêu","Ăn vào ít hơn tiêu","Nhịn ăn hoàn toàn"]'::jsonb, 2,
   'Giảm mỡ khi năng lượng vào ít hơn năng lượng tiêu hao.', 2),
  ('cccccccc-0000-0000-0000-000000000001',
   'Nhóm nào KHÔNG sinh năng lượng theo bài học?',
   '["Tinh bột","Đạm","Béo","Nước lọc"]'::jsonb, 3,
   'Nước không cung cấp kcal.', 3)
on conflict do nothing;
