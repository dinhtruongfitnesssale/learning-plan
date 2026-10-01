-- ============================================================
-- Bếp Học — KHÓA RIÊNG TƯ
--
-- Khóa "riêng tư" đã xuất bản nhưng ẨN khỏi danh mục: học viên không
-- thấy, không học thử, không mua được. Chỉ thấy khi:
--   • là coach (vào học thẳng để TỰ HỌC, không cần ghi danh), hoặc
--   • được coach phân khóa / có ghi danh với khóa đó.
--
-- Chặn ở RLS (không chỉ ở giao diện): gọi thẳng REST API bằng anon key
-- cũng không đọc được tên khóa, chương hay nội dung bài.
--
-- Chạy SAU 0019_push.sql.
-- ============================================================

alter table public.courses
  add column if not exists private boolean not null default false;
comment on column public.courses.private is
  'Riêng tư: ẩn khỏi danh mục, chỉ coach + người có ghi danh thấy.';

-- Người đang đăng nhập có được THẤY khóa này không. security definer để
-- đọc courses/enrollments bên trong policy mà không vòng lặp RLS.
create or replace function public.can_see_course(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_coach() or exists (
    select 1 from public.courses c
    where c.id = p_course
      and c.published
      and (not c.private or exists (
        select 1 from public.enrollments e
        where e.course_id = c.id and e.user_id = auth.uid()
      ))
  );
$$;
revoke all on function public.can_see_course(uuid) from public, anon;
grant execute on function public.can_see_course(uuid) to authenticated;

drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select to authenticated
  using (public.can_see_course(id));

drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules for select to authenticated
  using (public.can_see_course(course_id));

drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons for select to authenticated
  using (public.is_coach() or (published and public.can_see_course(course_id)));

-- lesson_accessible (0018): thêm chặn học thử / mở lẻ với khóa riêng tư.
create or replace function public.lesson_accessible(p_user uuid, p_lesson_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_course uuid;
  v_status text;
  v_free   int;
  v_guest  boolean;
  v_pos    int;
begin
  select course_id into v_course from public.lessons where id = p_lesson_id;
  if v_course is null then return false; end if;

  if exists (select 1 from public.profiles where id = p_user and role = 'coach') then
    return true;
  end if;

  select status into v_status from public.enrollments
    where user_id = p_user and course_id = v_course;
  if v_status = 'approved' then return true; end if;
  if v_status = 'failed' then return false; end if;

  select is_guest into v_guest from public.profiles where id = p_user;
  if coalesce(v_guest, false) then return false; end if;

  -- Khóa RIÊNG TƯ: không học thử, không mở lẻ — chỉ ghi danh mới vào được.
  if exists (select 1 from public.courses where id = v_course and private) then
    return false;
  end if;

  if exists (select 1 from public.lesson_unlocks
             where user_id = p_user and lesson_id = p_lesson_id) then
    return true;
  end if;

  select free_lessons into v_free from public.courses where id = v_course;
  if coalesce(v_free, 0) <= 0 then return false; end if;

  with mods as (
    select id, row_number() over (order by sort_order, id) as r
    from public.modules where course_id = v_course
  ),
  ordered as (
    select l.id,
           row_number() over (
             order by case when l.module_id is null then 0
                           else coalesce(m.r, 1000000) end,
                      l.sort_order, l.id
           ) as pos
    from public.lessons l
    left join mods m on m.id = l.module_id
    where l.course_id = v_course and l.published
  )
  select pos into v_pos from ordered where id = p_lesson_id;

  return v_pos is not null and v_pos <= v_free;
end; $$;
