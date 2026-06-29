-- ============================================================
-- Bếp Học — giới hạn số lần FAIL quiz (tối đa 2 lần / quiz)
--
-- Quy tắc: mỗi quiz, học viên chỉ được fail tối đa 2 lần. Fail lần
-- thứ 2 thì CẢ KHÓA bị khóa (enrollments.status = 'failed'); học viên
-- phải "Yêu cầu học lại" để admin duyệt lại (cấp lại 2 lượt mới).
--
-- Chạy SAU 0005_enroll_update_policy.sql.
-- ============================================================

-- 1) Cho phép trạng thái 'failed' (khóa do fail quiz).
alter table public.enrollments drop constraint if exists enrollments_status_check;
alter table public.enrollments
  add constraint enrollments_status_check
  check (status in ('pending', 'approved', 'failed'));

-- 2) Mốc reset lượt làm: chỉ đếm các lần fail SAU mốc này.
--    Khi admin duyệt (kể cả duyệt học lại) sẽ đẩy mốc này = now()
--    để học viên có 2 lượt mới.
alter table public.enrollments
  add column if not exists attempts_reset_at timestamptz not null default now();

-- 3) Nộp quiz: chấm điểm + đếm fail + khóa khóa học khi fail đủ 2 lần.
create or replace function public.submit_quiz(p_lesson_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_quiz       public.quizzes;
  v_lesson     public.lessons;
  v_total      int := 0;
  v_correct    int := 0;
  v_percent    int;
  v_passed     boolean;
  v_xp         int := 0;
  v_bonus      int := 0;
  r            record;
  v_results    jsonb := '[]'::jsonb;
  v_enroll     public.enrollments;
  v_fails      int := 0;
  v_fails_left int := 2;
  v_locked     boolean := false;
begin
  if v_user is null then raise exception 'Chưa đăng nhập'; end if;

  select * into v_quiz from public.quizzes where lesson_id = p_lesson_id;
  if not found then raise exception 'Bài học chưa có quiz'; end if;
  select * into v_lesson from public.lessons where id = p_lesson_id;

  -- Khóa học đã bị khóa do fail quá số lần cho phép.
  select * into v_enroll from public.enrollments
    where user_id = v_user and course_id = v_lesson.course_id;
  if found and v_enroll.status = 'failed' then
    raise exception 'Khóa học đã bị khóa do làm sai quá số lần cho phép';
  end if;

  for r in
    select id, correct_index, explanation
    from public.quiz_questions where quiz_id = v_quiz.id order by sort_order
  loop
    v_total := v_total + 1;
    if (p_answers ->> r.id::text)::int = r.correct_index then
      v_correct := v_correct + 1;
      v_results := v_results || jsonb_build_object(
        'id', r.id, 'correct', true,
        'correct_index', r.correct_index, 'explanation', r.explanation);
    else
      v_results := v_results || jsonb_build_object(
        'id', r.id, 'correct', false,
        'correct_index', r.correct_index, 'explanation', r.explanation);
    end if;
  end loop;

  if v_total = 0 then raise exception 'Quiz chưa có câu hỏi'; end if;
  v_percent := round(v_correct::numeric / v_total * 100);
  v_passed  := v_percent >= v_quiz.pass_score;

  insert into public.quiz_attempts (user_id, quiz_id, score, total, percent, passed)
  values (v_user, v_quiz.id, v_correct, v_total, v_percent, v_passed);

  -- XP theo NĂNG LỰC: tỉ lệ thuận với % đúng, không phải chỉ vì mở quiz.
  if v_passed then
    v_xp := round(v_quiz.xp_reward * v_percent / 100.0);
    insert into public.xp_events (user_id, course_id, amount, reason, ref_id)
    values (v_user, v_lesson.course_id, v_xp, 'quiz', v_quiz.id);
    -- Thưởng biến đổi khi đạt điểm tuyệt đối.
    if v_percent = 100 then
      v_bonus := 10 + floor(random() * 16)::int;
      insert into public.xp_events (user_id, course_id, amount, reason, ref_id)
      values (v_user, v_lesson.course_id, v_bonus, 'quiz_bonus', v_quiz.id);
    end if;
  end if;

  -- Đếm fail & khóa khóa học. Chỉ áp dụng khi học viên có ghi danh và
  -- CHƯA từng đạt quiz này (kể từ mốc reset) — đã đạt thì không phạt nữa.
  if not v_passed and v_enroll.id is not null then
    if not exists (
      select 1 from public.quiz_attempts
      where user_id = v_user and quiz_id = v_quiz.id and passed
        and created_at >= v_enroll.attempts_reset_at
    ) then
      select count(*) into v_fails
      from public.quiz_attempts
      where user_id = v_user and quiz_id = v_quiz.id and not passed
        and created_at >= v_enroll.attempts_reset_at;

      v_fails_left := greatest(0, 2 - v_fails);
      if v_fails >= 2 then
        update public.enrollments set status = 'failed'
          where id = v_enroll.id;
        v_locked := true;
        v_fails_left := 0;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'correct', v_correct, 'total', v_total, 'percent', v_percent,
    'passed', v_passed, 'xp', v_xp, 'bonus', v_bonus, 'results', v_results,
    'locked', v_locked, 'fails_left', v_fails_left
  );
end;
$$;

-- 4) Học viên xin học lại (chỉ khi đang bị 'failed') → chuyển về 'pending'
--    để hiện trong hàng chờ duyệt của admin.
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
  update public.enrollments
    set status = 'pending'
    where user_id = v_user and course_id = p_course_id and status = 'failed';
end;
$$;
