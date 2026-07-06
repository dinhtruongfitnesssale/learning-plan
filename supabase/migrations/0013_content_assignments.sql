-- ============================================================
-- Bếp Học — PHÂN CÔNG NỘI DUNG theo từng học viên
-- Coach gán RIÊNG từng CHƯƠNG và/hoặc từng BÀI HỌC cho từng học viên.
--
-- Ngữ nghĩa (áp dụng theo từng khóa):
--   • Học viên KHÔNG có dòng phân công nào trong khóa → thấy TẤT CẢ
--     (tương thích ngược, giống trước đây).
--   • Học viên CÓ ít nhất một dòng phân công trong khóa → CHỈ thấy
--     chương/bài được gán. Gán cả chương = mở mọi bài trong chương đó.
--
-- Chạy SAU 0012_scheduled_unlock.sql.
-- ============================================================

-- Gán cả CHƯƠNG cho học viên (mở mọi bài trong chương).
create table if not exists public.module_assignments (
  user_id    uuid not null references public.profiles on delete cascade,
  module_id  uuid not null references public.modules  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

-- Gán riêng từng BÀI HỌC cho học viên.
create table if not exists public.lesson_assignments (
  user_id    uuid not null references public.profiles on delete cascade,
  lesson_id  uuid not null references public.lessons  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index if not exists idx_module_asg_user on public.module_assignments(user_id);
create index if not exists idx_lesson_asg_user on public.lesson_assignments(user_id);

-- ============================================================
-- RLS: học viên chỉ xem phân công của mình; coach toàn quyền.
-- ============================================================
alter table public.module_assignments enable row level security;
alter table public.lesson_assignments enable row level security;

create policy module_asg_select on public.module_assignments for select to authenticated
  using (user_id = auth.uid() or public.is_coach());
create policy module_asg_write on public.module_assignments for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

create policy lesson_asg_select on public.lesson_assignments for select to authenticated
  using (user_id = auth.uid() or public.is_coach());
create policy lesson_asg_write on public.lesson_assignments for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- ============================================================
-- Helper: bài học có bị ẨN khỏi học viên do phân công nội dung không?
-- true  = học viên bị giới hạn trong khóa và bài này KHÔNG được gán.
-- false = không giới hạn, hoặc bài được gán (trực tiếp / qua chương).
-- ============================================================
create or replace function public.content_hidden(p_user uuid, p_lesson_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_course_id  uuid;
  v_module_id  uuid;
  v_restricted boolean;
  v_visible    boolean;
begin
  select course_id, module_id into v_course_id, v_module_id
    from public.lessons where id = p_lesson_id;
  if v_course_id is null then return false; end if;

  -- Học viên có bị giới hạn trong KHÓA này không?
  v_restricted :=
    exists (
      select 1 from public.module_assignments ma
      join public.modules m on m.id = ma.module_id
      where ma.user_id = p_user and m.course_id = v_course_id
    )
    or exists (
      select 1 from public.lesson_assignments la
      join public.lessons l on l.id = la.lesson_id
      where la.user_id = p_user and l.course_id = v_course_id
    );
  if not v_restricted then return false; end if;

  -- Bài này có được gán (trực tiếp hoặc qua cả chương) không?
  v_visible :=
    exists (
      select 1 from public.lesson_assignments la
      where la.user_id = p_user and la.lesson_id = p_lesson_id
    )
    or (v_module_id is not null and exists (
      select 1 from public.module_assignments ma
      where ma.user_id = p_user and ma.module_id = v_module_id
    ));

  return not v_visible;
end;
$$;

-- ============================================================
-- Định nghĩa lại complete_lesson: thêm lớp phòng vệ chặn hoàn thành
-- bài CHƯA ĐƯỢC GÁN cho học viên (phân công nội dung). Giữ nguyên các
-- lớp khóa cũ: lịch mở theo ngày (0012) + đạt quiz trước (0010).
-- ============================================================
create or replace function public.complete_lesson(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_lesson   public.lessons;
  v_already  boolean;
  v_base     int;
  v_bonus    int;
  v_today    date := current_date;
  v_mod_date date;
  s          public.streaks;
begin
  if v_user is null then raise exception 'Chưa đăng nhập'; end if;

  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found then raise exception 'Không thấy bài học'; end if;

  select exists(
    select 1 from public.lesson_progress
    where user_id = v_user and lesson_id = p_lesson_id
  ) into v_already;

  if v_already then
    return jsonb_build_object('already', true, 'xp', 0, 'bonus', 0);
  end if;

  -- Bài chưa được gán cho học viên (phân công nội dung) → chặn.
  if public.content_hidden(v_user, p_lesson_id) then
    raise exception 'Bài học chưa được mở cho bạn';
  end if;

  -- Chưa tới ngày mở của bài → chặn.
  if v_lesson.available_on is not null and v_lesson.available_on > v_today then
    raise exception 'Bài học chưa tới ngày mở';
  end if;
  -- Chưa tới ngày mở của chương chứa bài → chặn.
  if v_lesson.module_id is not null then
    select available_on into v_mod_date
      from public.modules where id = v_lesson.module_id;
    if v_mod_date is not null and v_mod_date > v_today then
      raise exception 'Chương chưa tới ngày mở';
    end if;
  end if;

  -- Bài có quiz thì phải ĐẠT quiz trước khi được hoàn thành.
  if exists (select 1 from public.quizzes where lesson_id = p_lesson_id) then
    if not exists (
      select 1
      from public.quiz_attempts qa
      join public.quizzes q on q.id = qa.quiz_id
      where q.lesson_id = p_lesson_id
        and qa.user_id = v_user
        and qa.passed
    ) then
      raise exception 'Cần đạt bài quiz trước khi hoàn thành bài học';
    end if;
  end if;

  insert into public.lesson_progress (user_id, lesson_id)
  values (v_user, p_lesson_id);

  v_base  := v_lesson.xp_reward;
  -- Thưởng biến đổi (anticipation > sợ mất): 0..15 XP ngẫu nhiên.
  v_bonus := floor(random() * 16)::int;

  insert into public.xp_events (user_id, course_id, amount, reason, ref_id)
  values (v_user, v_lesson.course_id, v_base, 'lesson', p_lesson_id);
  if v_bonus > 0 then
    insert into public.xp_events (user_id, course_id, amount, reason, ref_id)
    values (v_user, v_lesson.course_id, v_bonus, 'lesson_bonus', p_lesson_id);
  end if;

  -- Cập nhật streak (tha thứ 1 ngày lỡ nếu còn "đóng băng").
  select * into s from public.streaks where user_id = v_user for update;
  if s.last_active_date is null then
    s.current_streak := 1;
  elsif s.last_active_date = v_today then
    null; -- đã học hôm nay
  elsif s.last_active_date = v_today - 1 then
    s.current_streak := s.current_streak + 1;
  elsif s.last_active_date = v_today - 2 and s.freezes > 0 then
    s.freezes := s.freezes - 1;
    s.current_streak := s.current_streak + 1;
  else
    s.current_streak := 1;
  end if;
  update public.streaks set
    current_streak = s.current_streak,
    longest_streak = greatest(longest_streak, s.current_streak),
    last_active_date = v_today,
    freezes = s.freezes
  where user_id = v_user;

  return jsonb_build_object(
    'already', false,
    'xp', v_base,
    'bonus', v_bonus,
    'streak', s.current_streak
  );
end;
$$;
