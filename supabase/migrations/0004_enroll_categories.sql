-- ============================================================
-- Bếp Học — loại khóa học + duyệt ghi danh
-- Chạy SAU 0003_download_toggle.sql.
-- ============================================================

-- Loại khóa: dinh dưỡng / tập luyện
alter table public.courses
  add column if not exists category text not null default 'dinh_duong'
    check (category in ('dinh_duong', 'tap_luyen'));

-- Trạng thái ghi danh: chờ duyệt / đã duyệt
-- (default 'approved' để các ghi danh CŨ vẫn học được bình thường)
alter table public.enrollments
  add column if not exists status text not null default 'approved'
    check (status in ('pending', 'approved'));

-- Gán loại cho khóa mẫu (nếu có)
update public.courses set category = 'tap_luyen'  where slug = 'tap-luyen-co-ban';
update public.courses set category = 'dinh_duong' where slug = 'dinh-duong-nen-tang';

-- Email trong profiles (để admin tìm học viên theo email)
alter table public.profiles
  add column if not exists email text not null default '';

update public.profiles p
  set email = u.email
  from auth.users u
  where u.id = p.id and (p.email is null or p.email = '');

-- Cập nhật trigger: lưu cả email khi tạo user mới
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    case when new.email in (
           'ladysfit.mastertrainer@gmail.com',
           'tbtrungdvhn@gmail.com'
         ) then 'coach' else 'learner' end
  )
  on conflict (id) do nothing;
  insert into public.streaks (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end; $$;
