-- ============================================================
-- Bếp Học — THỨ TỰ CHƯƠNG / BÀI ổn định
--
-- Lỗi: sort_order của chương (và bài) có thể TRÙNG nhau (do trước đây
-- gán sort_order = số lượng hiện có; xóa 1 chương rồi thêm mới sẽ tạo
-- số trùng). Khi hai chương trùng sort_order, Postgres trả về theo thứ
-- tự vật lý của hàng — mỗi lần UPDATE (ví dụ chỉnh NGÀY MỞ) hàng bị đổi
-- chỗ nên thứ tự nhảy lung tung. NGÀY không phải nguyên nhân.
--
-- Khắc phục: (1) modules có created_at để làm mốc phụ ổn định;
--           (2) đánh lại sort_order duy nhất, giữ nguyên thứ tự đang thấy.
-- Chạy SAU 0013_content_assignments.sql.
-- ============================================================

-- Mốc thời gian tạo chương (để sắp xếp phụ ổn định về sau).
alter table public.modules
  add column if not exists created_at timestamptz not null default now();

-- Đánh lại sort_order CHƯƠNG: 0,1,2… duy nhất trong mỗi khóa, giữ nguyên
-- thứ tự hiện tại (sort_order cũ, rồi id để phá hòa cố định).
with ordered as (
  select id,
         row_number() over (
           partition by course_id order by sort_order, id
         ) - 1 as rn
  from public.modules
)
update public.modules m
   set sort_order = o.rn
  from ordered o
 where o.id = m.id
   and m.sort_order is distinct from o.rn;

-- Đánh lại sort_order BÀI HỌC tương tự (chống trùng sau khi xóa/thêm).
with ordered as (
  select id,
         row_number() over (
           partition by course_id order by sort_order, created_at, id
         ) - 1 as rn
  from public.lessons
)
update public.lessons l
   set sort_order = o.rn
  from ordered o
 where o.id = l.id
   and l.sort_order is distinct from o.rn;
