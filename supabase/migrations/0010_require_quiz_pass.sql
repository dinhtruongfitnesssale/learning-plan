-- ============================================================
-- Bếp Học — bắt buộc ĐẠT quiz mới được đánh dấu hoàn thành bài
-- Chạy SAU 0009_quiz_select_policy.sql.
-- ============================================================

-- Định nghĩa lại complete_lesson: nếu bài có quiz thì phải có ít nhất
-- một lượt làm ĐẠT (passed) mới cho hoàn thành. Chặn ở server để học
-- viên không thể gọi thẳng RPC bỏ qua giao diện.
create or replace function public.complete_lesson(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_lesson  public.lessons;
  v_already boolean;
  v_base    int;
  v_bonus   int;
  v_today   date := current_date;
  s         public.streaks;
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
