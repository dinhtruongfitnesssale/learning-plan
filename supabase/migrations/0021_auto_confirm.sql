-- ============================================================
-- Bếp Học — TỰ ĐỘNG CHỐT THANH TOÁN
--
-- Trước: webhook khớp mã → 'matched' → coach PHẢI bấm chốt.
-- Giờ:   webhook khớp mã → server HỎI LẠI SePay API giao dịch có thật
--        không → nếu qua hết các chốt chặn dưới đây thì tự mở khóa /
--        cộng xu, rồi báo về điện thoại coach. Không qua → vẫn 'matched'
--        chờ coach bấm như cũ.
--
-- Chốt chặn (đều nằm trong auto_confirm_payment, một transaction):
--   • Công tắc tổng auto_enabled (coach tắt khẩn cấp được).
--   • Số tiền thật (đã hỏi lại SePay) KHỚP TUYỆT ĐỐI với đơn. Thừa /
--     thiếu → để coach xử.
--   • Dưới trần: auto_course_max (học phí) / auto_topup_max (nạp xu).
--
-- Chạy SAU 0020_private_courses.sql.
-- ============================================================

create table if not exists public.payment_settings (
  id              int primary key default 1 check (id = 1),
  auto_enabled    boolean not null default true,
  -- VND. Đơn LỚN HƠN trần thì chờ coach chốt tay. 0 = không tự chốt loại đó.
  auto_course_max int not null default 2000000 check (auto_course_max >= 0),
  auto_topup_max  int not null default 2000000 check (auto_topup_max >= 0),
  updated_at      timestamptz not null default now()
);
insert into public.payment_settings (id) values (1) on conflict (id) do nothing;

alter table public.payment_settings enable row level security;
drop policy if exists payment_settings_coach on public.payment_settings;
create policy payment_settings_coach on public.payment_settings for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- Đơn được chốt tự động hay do coach bấm — để soi lại khi cần.
alter table public.payments
  add column if not exists auto_confirmed boolean not null default false;

-- ── Phần "giao hàng" dùng chung cho chốt tay và chốt tự động ──
create or replace function public._fulfill_payment(p_pay public.payments)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pay.user_id is null then raise exception 'Học viên đã bị xóa'; end if;
  if p_pay.coins > 0 then
    perform public._award_coins(p_pay.user_id, 'topup', 'payment:' || p_pay.id,
                                p_pay.coins, false, null, p_pay.course_title);
    return 'topup';
  end if;
  if p_pay.course_id is null then raise exception 'Khóa học đã bị xóa'; end if;
  insert into public.enrollments (user_id, course_id, status, attempts_reset_at)
  values (p_pay.user_id, p_pay.course_id, 'approved', now())
  on conflict (user_id, course_id)
    do update set status = 'approved', attempts_reset_at = now();
  return 'course';
end; $$;
revoke all on function public._fulfill_payment(public.payments) from public, anon, authenticated;

-- confirm_payment (coach bấm tay): giữ hành vi 0018, dùng chung _fulfill.
create or replace function public.confirm_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay  public.payments;
  v_kind text;
begin
  if not public.is_coach() then raise exception 'Không có quyền'; end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Không tìm thấy giao dịch'; end if;
  v_kind := case when v_pay.coins > 0 then 'topup' else 'course' end;

  if v_pay.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'already', true, 'kind', v_kind,
                              'user_id', v_pay.user_id, 'course_id', v_pay.course_id,
                              'coins', v_pay.coins);
  end if;
  if v_pay.status not in ('pending', 'matched') then
    raise exception 'Giao dịch đã đóng (%)', v_pay.status;
  end if;

  perform public._fulfill_payment(v_pay);
  update public.payments
    set status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid()
    where id = v_pay.id;

  return jsonb_build_object('ok', true, 'already', false, 'kind', v_kind,
                            'user_id', v_pay.user_id, 'course_id', v_pay.course_id,
                            'coins', v_pay.coins);
end; $$;

-- ── Tự chốt (chỉ server gọi bằng service role, SAU khi đã hỏi lại SePay) ──
-- p_verified_amount: số tiền SePay API xác nhận — KHÔNG phải số trong
-- webhook (webhook có thể bị giả, API thì không).
-- Trả về { result: confirmed | disabled | over_cap | amount_mismatch |
--          not_matched, ... } — mọi trường hợp không 'confirmed' thì đơn
-- giữ nguyên 'matched' chờ coach.
create or replace function public.auto_confirm_payment(
  p_code            text,
  p_verified_amount int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay  public.payments;
  s      public.payment_settings;
  v_kind text;
  v_cap  int;
begin
  select * into v_pay from public.payments where code = p_code for update;
  if not found or v_pay.status <> 'matched' then
    return jsonb_build_object('result', 'not_matched');
  end if;
  v_kind := case when v_pay.coins > 0 then 'topup' else 'course' end;

  select * into s from public.payment_settings where id = 1;
  if s is null or not s.auto_enabled then
    return jsonb_build_object('result', 'disabled', 'kind', v_kind);
  end if;

  if p_verified_amount is distinct from v_pay.amount
     or v_pay.bank_amount is distinct from v_pay.amount then
    return jsonb_build_object('result', 'amount_mismatch', 'kind', v_kind);
  end if;

  v_cap := case when v_kind = 'topup' then s.auto_topup_max else s.auto_course_max end;
  if v_pay.amount > v_cap then
    return jsonb_build_object('result', 'over_cap', 'kind', v_kind, 'cap', v_cap);
  end if;

  perform public._fulfill_payment(v_pay);
  update public.payments
    set status = 'confirmed', confirmed_at = now(), confirmed_by = null,
        auto_confirmed = true
    where id = v_pay.id;

  return jsonb_build_object('result', 'confirmed', 'kind', v_kind);
end; $$;
revoke all on function public.auto_confirm_payment(text, int) from public, anon, authenticated;
