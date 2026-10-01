-- ============================================================
-- Bếp Học — THANH TOÁN KHÓA HỌC (bán tự động)
--
-- Luồng: học viên bấm "Đăng ký" → hệ thống sinh MÃ duy nhất
-- (BH + 8 ký tự) và số tiền chốt từ courses.price → học viên
-- chuyển khoản với mã đó trong nội dung → ngân hàng/cổng bắn
-- webhook về → hệ thống tự khớp mã (status 'matched') → COACH
-- bấm 1 nút xác nhận → mở khóa học.
--
-- Chốt chặn con người ở bước cuối là CỐ Ý: mọi bug khớp lệnh đều
-- bị bắt trước khi thành quyền truy cập. Bỏ nút bấm sau, khi đã
-- chạy ổn định vài trăm giao dịch.
--
-- Chạy SAU 0016_guest_access.sql.
-- ============================================================

-- ============================================================
-- 1. VÁ LỖ HỔNG: học viên tự đặt status = 'approved'
-- ============================================================
-- Policy enroll_insert (0016) chỉ kiểm tra user_id và cờ khách mời,
-- KHÔNG ràng buộc cột status — trong khi status lại default 'approved'
-- (0004). Hệ quả: bất kỳ ai đã đăng nhập cũng POST thẳng được
--   /rest/v1/enrollments  {user_id: <chính họ>, course_id: <bất kỳ>,
--                          status: "approved"}
-- bằng anon key nằm sẵn trong JS trình duyệt, rồi vào học ngay mà
-- coach không hề duyệt. Code app luôn ghi 'pending' nhưng code app
-- không phải hàng rào — REST API của Supabase là công khai.
--
-- Có thanh toán rồi thì đây là lỗ "lấy hàng không trả tiền".

-- Mặc định an toàn: ghi danh mới là CHỜ DUYỆT, không phải đã duyệt.
alter table public.enrollments alter column status set default 'pending';

drop policy if exists enroll_insert on public.enrollments;
create policy enroll_insert on public.enrollments for insert to authenticated
  with check (
    public.is_coach()
    or (
      user_id = auth.uid()
      and not public.is_guest()
      and status = 'pending'      -- ← điều kiện còn thiếu
    )
  );

-- Dọn hậu quả nếu đã có người khai thác: ghi danh 'approved' mà KHÔNG
-- có XP nào thì gần như chắc chắn không phải do coach mở. Cố ý KHÔNG
-- tự động xóa — chạy tay câu dưới để soi trước khi quyết định.
--
--   select e.id, p.email, c.title, e.created_at
--   from public.enrollments e
--   join public.profiles p on p.id = e.user_id
--   join public.courses  c on c.id = e.course_id
--   where e.status = 'approved'
--     and not exists (select 1 from public.xp_events x
--                     where x.user_id = e.user_id and x.course_id = e.course_id)
--   order by e.created_at desc;

-- ============================================================
-- 2. GIÁ KHÓA HỌC
-- ============================================================
-- VND, số nguyên — không bao giờ dùng float cho tiền.
-- 0 = miễn phí, giữ nguyên luồng "Yêu cầu học" cũ.
alter table public.courses
  add column if not exists price int not null default 0 check (price >= 0);

-- ============================================================
-- 3. SỔ GIAO DỊCH
-- ============================================================
-- payments = ĐƠN hàng (có vòng đời), payment_events = LOG THÔ mọi lần
-- webhook bắn về (chỉ ghi thêm). Tách đôi để khi tranh chấp còn đối
-- chiếu được với sao kê ngân hàng.
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  -- Mã ghi trong nội dung chuyển khoản. Ngẫu nhiên, KHÔNG chạy số thứ
  -- tự — số thứ tự thì đoán được mã của người khác để nhận vơ.
  code         text not null unique,
  user_id      uuid references public.profiles on delete set null,
  course_id    uuid references public.courses  on delete set null,
  -- Ảnh chụp tại thời điểm tạo đơn: sổ tiền phải đọc được cả khi học
  -- viên hoặc khóa học đã bị xóa. FK ở trên chỉ để join cho tiện.
  user_email   text not null default '',
  course_title text not null default '',
  -- Số tiền do SERVER chốt từ courses.price, không bao giờ nhận từ
  -- client. Đổi giá khóa học về sau không làm đổi đơn đã tạo.
  amount       int  not null check (amount > 0),
  status       text not null default 'pending'
                 check (status in ('pending','matched','confirmed','rejected','expired')),
  -- Thông tin ngân hàng, điền khi webhook khớp được mã.
  bank_ref     text,
  bank_amount  int,
  bank_content text,
  matched_at   timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles on delete set null,
  note         text not null default '',
  expires_at   timestamptz not null default now() + interval '48 hours',
  created_at   timestamptz not null default now()
);

create index if not exists payments_status_idx on public.payments (status, created_at desc);
create index if not exists payments_user_idx   on public.payments (user_id);

-- Mỗi học viên chỉ có MỘT đơn đang mở cho mỗi khóa. Bấm "Đăng ký" mười
-- lần không sinh mười mã — nếu không, học viên rất dễ chuyển khoản
-- bằng một mã cũ đã bỏ đi.
create unique index if not exists payments_one_open_idx
  on public.payments (user_id, course_id)
  where status in ('pending', 'matched');

create table if not exists public.payment_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  -- Mã giao dịch phía ngân hàng/cổng. Khóa CHỐNG GỬI LẶP: cổng gửi lại
  -- webhook 2-3 lần là chuyện bình thường, không phải sự cố.
  provider_ref text not null,
  amount       int  not null,
  content      text not null default '',
  payload      jsonb not null,
  payment_id   uuid references public.payments on delete set null,
  result       text not null default 'processing',
  created_at   timestamptz not null default now(),
  unique (provider, provider_ref)
);

create index if not exists payment_events_result_idx
  on public.payment_events (result, created_at desc);

-- ============================================================
-- 4. RLS
-- ============================================================
alter table public.payments       enable row level security;
alter table public.payment_events enable row level security;

-- Học viên chỉ thấy đơn của mình; coach thấy tất cả.
drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments for select to authenticated
  using (user_id = auth.uid() or public.is_coach());

-- CỐ Ý không có policy insert/update/delete — kể cả cho coach. Mọi thay
-- đổi đi qua RPC bên dưới, để số tiền luôn do server tính và không ai
-- sửa được sổ bằng REST API.

-- payment_events: bật RLS và KHÔNG có policy nào → chỉ service_role
-- (webhook) chạm tới được. Log thô có thể chứa dữ liệu ngân hàng.

-- ============================================================
-- 5. RPC — HỌC VIÊN TẠO ĐƠN
-- ============================================================
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

  if exists (
    select 1 from public.enrollments
    where user_id = v_user and course_id = p_course_id and status = 'approved'
  ) then
    raise exception 'Bạn đã được mở khóa học này';
  end if;

  -- Đóng đơn cũ đã quá hạn trước, để unique index không chặn đơn mới.
  update public.payments set status = 'expired'
    where user_id = v_user and course_id = p_course_id
      and status = 'pending' and expires_at < now();

  -- Còn đơn đang mở → trả lại ĐÚNG đơn đó (idempotent).
  select * into v_pay from public.payments
    where user_id = v_user and course_id = p_course_id
      and status in ('pending', 'matched')
    limit 1;
  if found then return v_pay; end if;

  select email into v_email from public.profiles where id = v_user;

  -- gen_random_uuid() là nguồn ngẫu nhiên mã hóa, có sẵn ở pg_catalog
  -- (không cần pgcrypto). 8 ký tự hex = 4,3 tỷ khả năng.
  loop
    v_code := 'BH' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.payments where code = v_code);
  end loop;

  insert into public.payments
    (code, user_id, course_id, user_email, course_title, amount)
  values
    (v_code, v_user, p_course_id, coalesce(v_email, ''),
     v_course.title, v_course.price)
  returning * into v_pay;

  return v_pay;
end; $$;

revoke all on function public.create_payment_intent(uuid) from public;
grant execute on function public.create_payment_intent(uuid) to authenticated;

-- ============================================================
-- 6. RPC — WEBHOOK KHỚP LỆNH (chỉ service_role gọi)
-- ============================================================
-- Toàn bộ nằm trong MỘT transaction: chống gửi lặp, dò mã, khớp tiền và
-- ghi log là một khối. Làm ở tầng app thì hai webhook về cùng lúc sẽ
-- chen nhau và có thể khớp đôi.
create or replace function public.match_bank_transfer(
  p_provider text,
  p_ref      text,
  p_amount   int,
  p_content  text,
  p_payload  jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_code     text;
  v_pay      public.payments;
  v_result   text;
begin
  -- 1) Chống gửi lặp. Cùng (provider, ref) chỉ xử lý MỘT lần; lần sau
  --    insert đụng unique → không có id trả về → thoát sớm.
  insert into public.payment_events
    (provider, provider_ref, amount, content, payload, result)
  values
    (p_provider, p_ref, p_amount, coalesce(p_content, ''), p_payload, 'processing')
  on conflict (provider, provider_ref) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('ok', true, 'result', 'duplicate');
  end if;

  -- 2) Dò mã trong nội dung chuyển khoản. Ngân hàng hay viết hoa hết,
  --    bỏ dấu, chèn thêm chữ ("CT DEN:... BH1A2B3C4D ND:...") nên bắt
  --    bằng regex thay vì so khớp cả chuỗi.
  v_code := (regexp_match(upper(coalesce(p_content, '')), '(BH[0-9A-F]{8})'))[1];

  if v_code is null then
    v_result := 'no_code';
  else
    select * into v_pay from public.payments
      where code = v_code and status = 'pending'
      for update;

    if not found then
      v_result := 'unknown_code';        -- mã sai, hoặc đơn đã đóng
    elsif v_pay.expires_at < now() then
      v_result := 'expired';
    elsif p_amount < v_pay.amount then
      v_result := 'amount_short';        -- chuyển thiếu → để coach xử
    else
      update public.payments
        set status       = 'matched',
            bank_ref     = p_ref,
            bank_amount  = p_amount,
            bank_content = coalesce(p_content, ''),
            matched_at   = now()
        where id = v_pay.id;
      v_result := 'matched';             -- chuyển thừa cũng vào đây,
    end if;                              -- coach thấy bank_amount lệch
  end if;

  update public.payment_events
    set result     = v_result,
        payment_id = case when v_result = 'matched' then v_pay.id else null end
    where id = v_event_id;

  return jsonb_build_object('ok', true, 'result', v_result, 'code', v_code);
end; $$;

-- Không ai gọi được ngoài service_role (webhook).
revoke all on function public.match_bank_transfer(text, text, int, text, jsonb)
  from public, anon, authenticated;

-- ============================================================
-- 7. RPC — COACH CHỐT / TỪ CHỐI
-- ============================================================
-- Chốt tiền và mở khóa học trong CÙNG transaction: không bao giờ có
-- trạng thái "đã thu tiền mà chưa mở khóa" hay ngược lại.
create or replace function public.confirm_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payments;
  v_me  uuid := auth.uid();
begin
  if not public.is_coach() then raise exception 'Không có quyền'; end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Không tìm thấy giao dịch'; end if;

  -- Bấm hai lần không mở khóa hai lần, cũng không báo lỗi khó hiểu.
  if v_pay.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'already', true,
                              'user_id', v_pay.user_id,
                              'course_id', v_pay.course_id);
  end if;
  if v_pay.status not in ('pending', 'matched') then
    raise exception 'Giao dịch đã đóng (%)', v_pay.status;
  end if;
  if v_pay.user_id is null or v_pay.course_id is null then
    raise exception 'Học viên hoặc khóa học đã bị xóa';
  end if;

  insert into public.enrollments (user_id, course_id, status, attempts_reset_at)
  values (v_pay.user_id, v_pay.course_id, 'approved', now())
  on conflict (user_id, course_id)
    do update set status = 'approved', attempts_reset_at = now();

  update public.payments
    set status = 'confirmed', confirmed_at = now(), confirmed_by = v_me
    where id = v_pay.id;

  return jsonb_build_object('ok', true, 'already', false,
                            'user_id', v_pay.user_id,
                            'course_id', v_pay.course_id);
end; $$;

revoke all on function public.confirm_payment(uuid) from public;
grant execute on function public.confirm_payment(uuid) to authenticated;

-- Từ chối: KHÔNG xóa dòng. Sổ tiền chỉ đóng đơn, không bao giờ mất dấu.
create or replace function public.reject_payment(p_payment_id uuid, p_note text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_coach() then raise exception 'Không có quyền'; end if;
  update public.payments
    set status       = 'rejected',
        note         = coalesce(p_note, ''),
        confirmed_at = now(),
        confirmed_by = auth.uid()
    where id = p_payment_id and status in ('pending', 'matched');
end; $$;

revoke all on function public.reject_payment(uuid, text) from public;
grant execute on function public.reject_payment(uuid, text) to authenticated;

-- Dọn đơn quá hạn. Gọi định kỳ bằng pg_cron nếu muốn bảng sạch;
-- create_payment_intent vốn đã tự dọn phần của nó.
create or replace function public.expire_stale_payments()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  update public.payments set status = 'expired'
    where status = 'pending' and expires_at < now();
  get diagnostics v_n = row_count;
  return v_n;
end; $$;

revoke all on function public.expire_stale_payments() from public, anon, authenticated;
