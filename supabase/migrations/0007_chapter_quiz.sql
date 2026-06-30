-- ============================================================
-- Bếp Học — KIỂM TRA THEO CHƯƠNG (module quiz)
--
-- - Một quiz có thể gắn vào BÀI HỌC (lesson_id) HOẶC CHƯƠNG (module_id).
-- - Phải ĐẠT quiz chương mới học được chương kế tiếp (gating ở tầng app).
-- - Sai quiz chương 2 lần → khóa cả khóa học (giống quiz bài học).
--
-- Chạy SAU 0006_quiz_fail_lock.sql.
-- ============================================================

-- 1) quizzes: cho phép gắn vào chương thay vì bài học.
alter table public.quizzes alter column lesson_id drop not null;
alter table public.quizzes
  add column if not exists module_id uuid references public.modules on delete cascade;

-- Mỗi chương tối đa 1 quiz.
create unique index if not exists quizzes_module_uniq
  on public.quizzes (module_id) where module_id is not null;

-- Đúng MỘT trong hai: lesson_id hoặc module_id.
alter table public.quizzes drop constraint if exists quizzes_target_chk;
alter table public.quizzes
  add constraint quizzes_target_chk check (num_nonnulls(lesson_id, module_id) = 1);

-- 2) Lấy câu hỏi quiz CHƯƠNG (không lộ đáp án).
create or replace function public.get_module_quiz(p_module_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz public.quizzes;
  v_qs   jsonb;
begin
  select * into v_quiz from public.quizzes where module_id = p_module_id;
  if not found then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'prompt', prompt, 'options', options
         ) order by sort_order), '[]'::jsonb)
  into v_qs
  from public.quiz_questions where quiz_id = v_quiz.id;

  return jsonb_build_object(
    'id', v_quiz.id,
    'title', v_quiz.title,
    'pass_score', v_quiz.pass_score,
    'questions', v_qs
  );
end;
$$;

-- 3) Nộp quiz CHƯƠNG: chấm điểm + đếm fail + khóa khóa học khi fail 2 lần.
create or replace function public.submit_module_quiz(p_module_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_quiz       public.quizzes;
  v_module     public.modules;
  v_course_id  uuid;
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

  select * into v_quiz from public.quizzes where module_id = p_module_id;
  if not found then raise exception 'Chương chưa có quiz'; end if;
  select * into v_module from public.modules where id = p_module_id;
  v_course_id := v_module.course_id;

  select * into v_enroll from public.enrollments
    where user_id = v_user and course_id = v_course_id;
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

  if v_passed then
    v_xp := round(v_quiz.xp_reward * v_percent / 100.0);
    insert into public.xp_events (user_id, course_id, amount, reason, ref_id)
    values (v_user, v_course_id, v_xp, 'quiz', v_quiz.id);
    if v_percent = 100 then
      v_bonus := 10 + floor(random() * 16)::int;
      insert into public.xp_events (user_id, course_id, amount, reason, ref_id)
      values (v_user, v_course_id, v_bonus, 'quiz_bonus', v_quiz.id);
    end if;
  end if;

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
        update public.enrollments set status = 'failed' where id = v_enroll.id;
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
