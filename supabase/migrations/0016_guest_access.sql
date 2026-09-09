-- ============================================================
-- Bếp Học — TÀI KHOẢN KHÁCH MỜI (give-away khóa học)
--
-- Nhu cầu: tặng một khóa cho nhiều người cùng lúc mà không phải
-- ngồi tạo tài khoản từng người. Coach dán một loạt email vào
-- trang khóa học → hệ thống tự tạo tài khoản (mật khẩu ngẫu
-- nhiên), mở sẵn khóa đó và gửi email hướng dẫn đăng nhập.
--
-- Khách mời đăng nhập & học như học viên thật, vẫn THẤY các khóa
-- khác nhưng KHÔNG được bấm "Yêu cầu học" — mọi khóa chưa được
-- tặng đều hiện ổ khóa, hover ra "Hãy liên hệ admin…".
--
-- Chạy SAU 0015_custom_email_sent.sql.
-- ============================================================

-- Cờ khách mời. Mặc định false → học viên cũ không đổi hành vi.
alter table public.profiles
  add column if not exists is_guest boolean not null default false;

-- Helper: user hiện tại có phải khách mời không.
create or replace function public.is_guest()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_guest
  );
$$;

-- Chặn ở tầng DB: khách mời không tự ghi danh được (nút bấm đã ẩn,
-- đây là lớp phòng vệ thứ hai nếu ai đó gọi thẳng API).
drop policy if exists enroll_insert on public.enrollments;
create policy enroll_insert on public.enrollments for insert to authenticated
  with check (
    public.is_coach()
    or (user_id = auth.uid() and not public.is_guest())
  );

-- Tương tự cho "xin học lại" sau khi bị khóa do fail quiz.
create or replace function public.request_relearn(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Chưa đăng nhập'; end if;
  if public.is_guest() then
    raise exception 'Tài khoản khách mời cần liên hệ admin để được mở khóa học';
  end if;
  update public.enrollments
    set status = 'pending'
    where user_id = v_user and course_id = p_course_id and status = 'failed';
end;
$$;
