-- Trang giới thiệu khóa học (/hoc/khoa-hoc/<slug>) kiểu Coursera: học viên
-- đọc kỹ khóa trước khi đăng ký / xuống tiền.
--   • Thêm nội dung giới thiệu cho mỗi khóa (coach soạn ở Admin → Khóa học).
--   • Số học viên + điểm đánh giá công khai: RLS chỉ cho học viên đọc ghi
--     danh / đánh giá của chính mình, nên đọc qua hàm security definer chỉ
--     trả số liệu gộp và lời nhận xét kèm TÊN GỌI (không email, không họ).

alter table public.courses
  add column if not exists intro           text not null default '',
  add column if not exists outcomes        text not null default '',
  add column if not exists audience        text not null default '',
  add column if not exists instructor_name text not null default '',
  add column if not exists instructor_bio  text not null default '';

comment on column public.courses.intro is 'Giới thiệu chi tiết (markdown) trên trang giới thiệu khóa.';
comment on column public.courses.outcomes is 'Bạn sẽ học được gì — mỗi dòng một ý.';
comment on column public.courses.audience is 'Khóa này dành cho ai — mỗi dòng một ý.';

-- Số học viên đã vào học + điểm đánh giá trung bình của một khóa.
create or replace function public.course_public_stats(p_course_id uuid)
returns table (learners int, reviews int, avg_rating numeric)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.enrollments
      where course_id = p_course_id and status = 'approved'),
    (select count(*)::int from public.course_reviews where course_id = p_course_id),
    (select round(avg(r_overall)::numeric, 1) from public.course_reviews
      where course_id = p_course_id);
$$;

-- Nhận xét gần nhất có lời bình, chỉ kèm tên gọi (chữ cuối của họ tên).
create or replace function public.course_public_reviews(p_course_id uuid, p_limit int default 6)
returns table (first_name text, rating int, comment text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(regexp_replace(trim(p.full_name), '^.*\s', ''), ''), 'Học viên'),
    r.r_overall::int,
    r.comment,
    r.created_at
  from public.course_reviews r
  left join public.profiles p on p.id = r.user_id
  where r.course_id = p_course_id and length(trim(r.comment)) > 0
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 20);
$$;

revoke all on function public.course_public_stats(uuid) from public, anon;
revoke all on function public.course_public_reviews(uuid, int) from public, anon;
grant execute on function public.course_public_stats(uuid) to authenticated;
grant execute on function public.course_public_reviews(uuid, int) to authenticated;
