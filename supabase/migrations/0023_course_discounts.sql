-- ============================================================
-- Bếp Học — ƯU ĐÃI KHÓA HỌC
--
-- Coach đặt ưu đãi cho học phí chuyển khoản của từng khóa, 2 dạng:
--   • percent: giảm N% (1–99)
--   • amount : giảm thẳng N đồng (nhỏ hơn học phí)
-- Có thể đặt hạn kết thúc; hết hạn là tự về giá gốc, không cần tắt tay.
--
-- Giá sau ưu đãi do SERVER tính trong create_payment_intent — client
-- không bao giờ gửi số tiền lên. Giá xu không bị ảnh hưởng.
--
-- Chạy SAU 0022_auto_approve.sql.
-- ============================================================

alter table public.courses
  add column if not exists discount_type     text
    check (discount_type in ('percent', 'amount')),
  add column if not exists discount_value    int not null default 0
    check (discount_value >= 0),
  add column if not exists discount_ends_at  timestamptz,
  add column if not exists discount_label    text not null default '';

alter table public.courses drop constraint if exists courses_discount_percent_chk;
alter table public.courses add constraint courses_discount_percent_chk
  check (discount_type is distinct from 'percent' or discount_value <= 99);

comment on column public.courses.discount_type is
  'Ưu đãi học phí: percent (giảm %) | amount (giảm số tiền) | null = không ưu đãi.';
comment on column public.courses.discount_value is
  'Số % (1–99) hoặc số đồng được giảm.';
comment on column public.courses.discount_ends_at is
  'Hạn ưu đãi. null = không hạn.';
comment on column public.courses.discount_label is
  'Tên ưu đãi hiện cho học viên, vd "Ưu đãi khai trương".';

-- Học phí THỰC phải trả lúc này. Khớp coursePrice() bên app (lib/discount.ts).
-- Làm tròn về nghìn đồng cho số đẹp; không bao giờ âm.
create or replace function public.course_final_price(c public.courses)
returns int
language sql
stable
as $$
  select case
    when c.price <= 0
      or c.discount_type is null
      or c.discount_value <= 0
      or (c.discount_ends_at is not null and c.discount_ends_at <= now())
      then c.price
    when c.discount_type = 'percent'
      then greatest(round(c.price * (100 - least(c.discount_value, 99)) / 100000.0)::int * 1000, 0)
    else greatest(c.price - c.discount_value, 0)
  end;
$$;

-- Đơn chuyển khoản lưu thêm giá gốc để coach đối chiếu đơn có ưu đãi.
alter table public.payments
  add column if not exists list_price int;

-- create_payment_intent: chốt số tiền theo GIÁ SAU ƯU ĐÃI.
create or replace function public.create_payment_intent(p_course_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_course public.courses;
  v_pay    public.payments;
  v_email  text;
  v_code   text;
  v_amount int;
begin
  if v_user is null then raise exception 'Chưa đăng nhập'; end if;
  if public.is_guest() then
    raise exception 'Tài khoản khách mời cần liên hệ admin để được mở khóa học';
  end if;

  select * into v_course from public.courses where id = p_course_id;
  if not found or not v_course.published then
    raise exception 'Khóa học không tồn tại';
  end if;
  if v_course.price <= 0 then
    raise exception 'Khóa học này không thu phí';
  end if;

  v_amount := public.course_final_price(v_course);
  if v_amount <= 0 then
    raise exception 'Ưu đãi đang giảm hết học phí — hãy liên hệ coach để được mở khóa';
  end if;

  if exists (
    select 1 from public.enrollments
    where user_id = v_user and course_id = p_course_id and status = 'approved'
  ) then
    raise exception 'Bạn đã được mở khóa học này';
  end if;

  update public.payments set status = 'expired'
    where user_id = v_user and course_id = p_course_id
      and status = 'pending' and expires_at < now();

  select * into v_pay from public.payments
    where user_id = v_user and course_id = p_course_id
      and status in ('pending', 'matched')
    limit 1
    for update;
  if found then
    -- Đơn tạo TRƯỚC khi có ưu đãi → hạ tiền xuống cho học viên. Chỉ hạ,
    -- không nâng: ai đã quét QR giá cũ (thấp hơn) vẫn khớp được.
    if v_pay.status = 'pending' and v_amount < v_pay.amount then
      update public.payments
        set amount = v_amount,
            list_price = coalesce(list_price, v_pay.amount)
        where id = v_pay.id
        returning * into v_pay;
    end if;
    return v_pay;
  end if;

  select email into v_email from public.profiles where id = v_user;

  loop
    v_code := 'BH' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.payments where code = v_code);
  end loop;

  insert into public.payments
    (code, user_id, course_id, user_email, course_title, amount, list_price)
  values
    (v_code, v_user, p_course_id, coalesce(v_email, ''),
     v_course.title, v_amount, v_course.price)
  returning * into v_pay;

  return v_pay;
end; $$;

revoke all on function public.create_payment_intent(uuid) from public;
grant execute on function public.create_payment_intent(uuid) to authenticated;
