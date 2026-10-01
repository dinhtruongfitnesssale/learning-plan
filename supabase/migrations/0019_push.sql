-- ============================================================
-- Bếp Học — THÔNG BÁO ĐẨY (Web Push): nhắc học trên điện thoại
--
-- Học viên bấm "Bật nhắc học" → trình duyệt cấp một "địa chỉ nhận"
-- (endpoint + khóa mã hóa) → lưu vào push_subscriptions. Mỗi tối một
-- cron (Vercel) quét ai sắp đứt chuỗi / lâu không vào học rồi gửi.
--
-- Một người có thể có nhiều máy (điện thoại + laptop) → nhiều dòng.
-- Chạy SAU 0018_coins.sql.
-- ============================================================

create table if not exists public.push_subscriptions (
  -- Endpoint là duy nhất cho mỗi trình duyệt/máy. Cùng máy đổi tài khoản
  -- thì dòng chuyển sang người đăng nhập sau (xử lý ở server).
  endpoint    text primary key,
  user_id     uuid not null references public.profiles on delete cascade,
  p256dh      text not null,
  auth        text not null,
  user_agent  text not null default '',
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
-- Chỉ ĐỌC được của mình (để biết máy này đã bật chưa); coach đọc hết để
-- thống kê. Ghi/xóa đi qua server bằng service role.
drop policy if exists push_sub_select on public.push_subscriptions;
create policy push_sub_select on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid() or public.is_coach());

-- Nhật ký đã nhắc: (người, loại, ngày) chỉ gửi MỘT lần — cron có chạy
-- lại hay coach bấm "nhắc ngay" trùng giờ cũng không spam học viên.
create table if not exists public.push_log (
  user_id  uuid not null references public.profiles on delete cascade,
  kind     text not null,     -- streak | inactive | welcome | manual
  sent_on  date not null default current_date,
  sent_at  timestamptz not null default now(),
  primary key (user_id, kind, sent_on)
);
alter table public.push_log enable row level security;
drop policy if exists push_log_select on public.push_log;
create policy push_log_select on public.push_log for select to authenticated
  using (public.is_coach());
