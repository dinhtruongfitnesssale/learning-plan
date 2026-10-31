-- ============================================================
-- Bếp Học — MÃ KHUYẾN MÃI
--
-- Coach tạo nhiều mã (giảm % hoặc giảm số tiền). Học viên nhập mã ở
-- trang thanh toán của đơn học phí; server tính lại số tiền của đơn.
--
-- Mỗi mã coach tự đặt:
--   • áp cho tất cả khóa hoặc chỉ một số khóa
--   • hạn dùng, tổng số lượt (null = không giới hạn)
--   • stackable            : cộng dồn được với mã khác hay không
--   • with_course_discount : giảm tiếp trên giá đã có ưu đãi của khóa
--                            (tắt = tính trên giá gốc, học viên được
--                            mức có lợi hơn giữa ưu đãi khóa và mã)
-- Mỗi học viên dùng mỗi mã 1 lần.
--
-- Cách tính khi có nhiều mã: giảm % trước (nối tiếp, làm tròn nghìn
-- đồng mỗi bước), rồi trừ các mã giảm tiền. Không bao giờ âm. Giảm về
-- 0đ thì mở khóa luôn, không cần chuyển khoản.
--
-- Điều kiện của mã được CHỤP lại lúc áp vào đơn — coach sửa mã sau đó
-- không làm đổi số tiền của đơn đang mở.
--
-- Chạy SAU 0023_course_discounts.sql.
-- ============================================================

create table if not exists public.promo_codes (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique
                         check (code ~ '^[A-Z0-9_-]{3,30}$'),
  label                text not null default '',
  discount_type        text not null check (discount_type in ('percent', 'amount')),
  discount_value       int  not null check (discount_value > 0),
  all_courses          boolean not null default true,
  max_uses             int check (max_uses is null or max_uses > 0),
  ends_at              timestamptz,
  stackable            boolean not null default false,
  with_course_discount boolean not null default true,
  active               boolean not null default true,
  created_at           timestamptz not null default now(),
  constraint promo_codes_percent_chk
    check (discount_type <> 'percent' or discount_value <= 100)
);

-- Khóa được áp mã (chỉ dùng khi all_courses = false).
create table if not exists public.promo_code_courses (
  promo_id  uuid not null references public.promo_codes on delete cascade,
  course_id uuid not null references public.courses     on delete cascade,
  primary key (promo_id, course_id)
);

-- Mã đã áp vào đơn. Chụp lại điều kiện để đơn không đổi khi mã bị sửa/xóa.
create table if not exists public.payment_promos (
  id                   uuid primary key default gen_random_uuid(),
  payment_id           uuid not null references public.payments    on delete cascade,
  promo_id             uuid references public.promo_codes on delete set null,
  user_id              uuid references public.profiles    on delete set null,
  code                 text not null,
  discount_type        text not null,
  discount_value       int  not null,
  stackable            boolean not null,
  with_course_discount boolean not null,
  applied_at           timestamptz not null default now(),
  unique (payment_id, code)
);
create index if not exists payment_promos_promo_idx on public.payment_promos (promo_id);
create index if not exists payment_promos_user_idx  on public.payment_promos (user_id);

-- Đơn giảm về 0đ được chốt luôn → cho phép amount = 0.
alter table public.payments drop constraint if exists payments_amount_check;
alter table public.payments add constraint payments_amount_check check (amount >= 0);

-- Tiền của đơn ngay trước khi áp mã đầu tiên. Ưu đãi khóa hết hạn sau khi
-- tạo đơn thì vẫn tính từ mức này — áp mã không bao giờ làm đơn đắt lên.
alter table public.payments
  add column if not exists pre_promo_amount int;

-- ── RLS ──────────────────────────────────────────────────────
alter table public.promo_codes        enable row level security;
alter table public.promo_code_courses enable row level security;
alter table public.payment_promos     enable row level security;

-- Học viên KHÔNG đọc được danh sách mã (không cho dò mã).
drop policy if exists promo_codes_coach on public.promo_codes;
create policy promo_codes_coach on public.promo_codes for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

drop policy if exists promo_code_courses_coach on public.promo_code_courses;
create policy promo_code_courses_coach on public.promo_code_courses for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- Học viên thấy mã đã áp vào đơn của mình. Ghi/xóa chỉ qua RPC.
drop policy if exists payment_promos_select on public.payment_promos;
create policy payment_promos_select on public.payment_promos for select to authenticated
  using (user_id = auth.uid() or public.is_coach());

-- ── Lượt dùng ────────────────────────────────────────────────
-- Một lượt = mã nằm trên đơn còn sống (đang chờ chưa hết hạn, đã khớp
-- tiền, đã chốt). Đơn hết hạn / bị từ chối trả lượt lại.
create or replace function public._promo_live(p_pay public.payments)
returns boolean
language sql
stable
as $$
  select p_pay.status in ('matched', 'confirmed')
      or (p_pay.status = 'pending' and p_pay.expires_at > now());
$$;

create or replace function public.promo_uses(p_promo_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.payment_promos pp
  join public.payments p on p.id = pp.payment_id
  where pp.promo_id = p_promo_id and public._promo_live(p);
$$;
revoke all on function public.promo_uses(uuid) from public, anon;
grant execute on function public.promo_uses(uuid) to authenticated;

-- ── Tính giá ─────────────────────────────────────────────────
-- Áp các mã của đơn lên một mức giá: % trước (nối tiếp), tiền sau.
create or replace function public._apply_promos(p_payment_id uuid, p_start int)
returns int
language plpgsql
stable
set search_path = public
as $$
declare
  v int := p_start;
  r record;
begin
  for r in
    select discount_value from public.payment_promos
    where payment_id = p_payment_id and discount_type = 'percent'
    order by applied_at
  loop
    v := round(v * (100 - least(r.discount_value, 100)) / 100000.0)::int * 1000;
  end loop;
  for r in
    select discount_value from public.payment_promos
    where payment_id = p_payment_id and discount_type = 'amount'
    order by applied_at
  loop
    v := v - r.discount_value;
  end loop;
  return greatest(v, 0);
end; $$;

-- Học phí của một đơn: ưu đãi khóa + các mã đã áp.
create or replace function public.payment_course_price(p_payment_id uuid, c public.courses)
returns int
language plpgsql
stable
set search_path = public
as $$
declare
  v_sale     int := public.course_final_price(c);
  v_pre      int;
  v_n        int;
  v_all_with boolean;
begin
  select pre_promo_amount into v_pre from public.payments where id = p_payment_id;
  v_sale := least(v_sale, coalesce(v_pre, v_sale));
  select count(*), coalesce(bool_and(with_course_discount), true)
    into v_n, v_all_with
    from public.payment_promos where payment_id = p_payment_id;
  if v_n = 0 then return v_sale; end if;
  if v_all_with then
    return public._apply_promos(p_payment_id, v_sale);
  end if;
  -- Có mã không dùng chung với ưu đãi khóa → tính trên giá gốc, lấy mức
  -- có lợi hơn cho học viên.
  return least(v_sale, public._apply_promos(p_payment_id, c.price));
end; $$;

-- Tính lại tiền của đơn sau khi đổi mã. Về 0đ → mở khóa và chốt luôn.
create or replace function public._reprice_payment(p_pay public.payments)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course public.courses;
  v_amount int;
  v_pay    public.payments;
begin
  select * into v_course from public.courses where id = p_pay.course_id;
  if not found then raise exception 'Khóa học không tồn tại'; end if;

  v_amount := public.payment_course_price(p_pay.id, v_course);
  update public.payments
    set amount = v_amount,
        list_price = coalesce(list_price, v_course.price)
    where id = p_pay.id
    returning * into v_pay;

  if v_amount = 0 then
    perform public._fulfill_payment(v_pay);
    update public.payments
      set status = 'confirmed', confirmed_at = now(),
          note = 'Mã khuyến mãi giảm hết học phí'
      where id = v_pay.id;
    return jsonb_build_object('amount', 0, 'free', true);
  end if;
  return jsonb_build_object('amount', v_amount, 'free', false);
end; $$;
revoke all on function public._reprice_payment(public.payments) from public, anon, authenticated;

-- Đơn học phí đang chờ của chính học viên (khóa hàng để đổi mã an toàn).
create or replace function public._my_open_course_payment(p_payment_code text)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payments;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select * into v_pay from public.payments
    where code = p_payment_code and user_id = auth.uid()
    for update;
  if not found then raise exception 'Không tìm thấy đơn'; end if;
  if v_pay.coins > 0 or v_pay.course_id is null then
    raise exception 'Mã khuyến mãi chỉ dùng cho học phí khóa học';
  end if;
  if v_pay.status <> 'pending' or v_pay.expires_at <= now() then
    raise exception 'Đơn này không còn đổi mã được';
  end if;
  return v_pay;
end; $$;
revoke all on function public._my_open_course_payment(text) from public, anon, authenticated;

-- ── Học viên áp mã ───────────────────────────────────────────
create or replace function public.apply_promo_code(p_payment_code text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay   public.payments;
  v_promo public.promo_codes;
  v_code  text := upper(trim(coalesce(p_code, '')));
begin
  v_pay := public._my_open_course_payment(p_payment_code);

  -- Khóa hàng mã → hai người áp cùng lúc không vượt quá tổng lượt.
  select * into v_promo from public.promo_codes where code = v_code for update;
  if not found or not v_promo.active then
    raise exception 'Mã "%" không hợp lệ', v_code;
  end if;
  if v_promo.ends_at is not null and v_promo.ends_at <= now() then
    raise exception 'Mã "%" đã hết hạn', v_code;
  end if;
  if not v_promo.all_courses and not exists (
    select 1 from public.promo_code_courses
    where promo_id = v_promo.id and course_id = v_pay.course_id
  ) then
    raise exception 'Mã "%" không áp dụng cho khóa này', v_code;
  end if;
  if exists (
    select 1 from public.payment_promos
    where payment_id = v_pay.id and code = v_code
  ) then
    raise exception 'Bạn đã áp mã "%" rồi', v_code;
  end if;

  -- Cộng dồn: chỉ được dùng nhiều mã khi TẤT CẢ đều cho cộng dồn.
  if exists (select 1 from public.payment_promos where payment_id = v_pay.id) then
    if not v_promo.stackable then
      raise exception 'Mã "%" không dùng chung với mã khác — bỏ mã đang áp trước', v_code;
    end if;
    if exists (
      select 1 from public.payment_promos
      where payment_id = v_pay.id and not stackable
    ) then
      raise exception 'Mã đang áp không cho cộng dồn — bỏ mã đó trước';
    end if;
  end if;

  if v_promo.max_uses is not null
     and public.promo_uses(v_promo.id) >= v_promo.max_uses then
    raise exception 'Mã "%" đã hết lượt dùng', v_code;
  end if;
  if exists (
    select 1 from public.payment_promos pp
    join public.payments p on p.id = pp.payment_id
    where pp.promo_id = v_promo.id and pp.user_id = auth.uid()
      and public._promo_live(p)
  ) then
    raise exception 'Bạn đã dùng mã "%" rồi', v_code;
  end if;

  update public.payments
    set pre_promo_amount = coalesce(pre_promo_amount, amount)
    where id = v_pay.id;
  insert into public.payment_promos
    (payment_id, promo_id, user_id, code, discount_type, discount_value,
     stackable, with_course_discount)
  values
    (v_pay.id, v_promo.id, auth.uid(), v_promo.code, v_promo.discount_type,
     v_promo.discount_value, v_promo.stackable, v_promo.with_course_discount);

  return public._reprice_payment(v_pay);
end; $$;
revoke all on function public.apply_promo_code(text, text) from public, anon;
grant execute on function public.apply_promo_code(text, text) to authenticated;

-- ── Học viên bỏ mã ───────────────────────────────────────────
create or replace function public.remove_promo_code(p_payment_code text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payments;
begin
  v_pay := public._my_open_course_payment(p_payment_code);
  delete from public.payment_promos
    where payment_id = v_pay.id and code = upper(trim(coalesce(p_code, '')));
  return public._reprice_payment(v_pay);
end; $$;
revoke all on function public.remove_promo_code(text, text) from public, anon;
grant execute on function public.remove_promo_code(text, text) to authenticated;

-- ── create_payment_intent: tính cả mã đã áp khi mở lại đơn cũ ─
-- Giống 0023, chỉ khác: đơn đang chờ được tính lại bằng
-- payment_course_price (ưu đãi khóa + mã đã áp) thay vì chỉ ưu đãi khóa.
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
    -- Chỉ hạ, không nâng: ai đã quét QR giá cũ (thấp hơn) vẫn khớp được.
    v_amount := public.payment_course_price(v_pay.id, v_course);
    if v_pay.status = 'pending' and v_amount > 0 and v_amount < v_pay.amount then
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
