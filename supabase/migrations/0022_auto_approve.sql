-- ============================================================
-- Bếp Học — TỰ DUYỆT khóa miễn phí
--
-- Coach bật "Tự duyệt" cho một khóa → học viên bấm là vào học ngay,
-- không phải chờ coach duyệt ở mục Yêu cầu.
--
-- CHỈ có hiệu lực với khóa MIỄN PHÍ (học phí = 0, không bán bằng xu):
-- khóa có thu tiền mà tự duyệt thì thành mở cửa cho học chùa. Kiểm ở
-- RPC dưới đây — không phải ở giao diện — vì policy enroll_insert (0017)
-- chỉ cho học viên tự tạo ghi danh 'pending'.
--
-- Chạy SAU 0021_auto_confirm.sql.
-- ============================================================

alter table public.courses
  add column if not exists auto_approve boolean not null default false;
comment on column public.courses.auto_approve is
  'Tự duyệt: học viên bấm là vào học ngay (chỉ áp dụng khóa miễn phí).';

-- Khóa có đủ điều kiện tự duyệt không.
create or replace function public.course_auto_approves(c public.courses)
returns boolean
language sql
immutable
as $$
  select c.auto_approve and c.published and not c.private
     and c.price = 0 and c.course_coin_price = 0 and c.lesson_coin_price = 0;
$$;

-- Học viên bấm vào học một khóa tự duyệt → ghi danh 'approved' ngay.
-- Trả về trạng thái ghi danh sau khi gọi. Ghi danh 'failed' (khóa do
-- fail quiz) GIỮ NGUYÊN — mở lại vẫn là quyết định của coach.
create or replace function public.join_free_course(p_course_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_course public.courses;
  v_status text;
begin
  if v_user is null then raise exception 'Chưa đăng nhập'; end if;
  if public.is_guest() then
    raise exception 'Tài khoản khách mời cần liên hệ admin để được mở khóa học';
  end if;

  select * into v_course from public.courses where id = p_course_id;
  if not found or not public.course_auto_approves(v_course) then
    raise exception 'Khóa này cần coach duyệt';
  end if;

  select status into v_status from public.enrollments
    where user_id = v_user and course_id = p_course_id;
  if v_status = 'failed' then return 'failed'; end if;
  if v_status = 'approved' then return 'approved'; end if;

  insert into public.enrollments (user_id, course_id, status, attempts_reset_at)
  values (v_user, p_course_id, 'approved', now())
  on conflict (user_id, course_id)
    do update set status = 'approved', attempts_reset_at = now();
  return 'approved';
end; $$;
revoke all on function public.join_free_course(uuid) from public, anon;
grant execute on function public.join_free_course(uuid) to authenticated;
