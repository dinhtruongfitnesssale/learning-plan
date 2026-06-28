-- ============================================================
-- Bếp Học — schema khởi tạo
-- Chạy file này trong Supabase Dashboard > SQL Editor.
-- ============================================================

-- ============================================================
-- BẢNG
-- ============================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text not null default '',
  role        text not null default 'learner' check (role in ('learner','coach')),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  slug        text not null unique,
  summary     text not null default '',
  cover_emoji text not null default '🍲',
  accent      text not null default 'amber' check (accent in ('amber','herb','slate','clay')),
  sort_order  int  not null default 0,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses on delete cascade,
  title       text not null,
  sort_order  int  not null default 0
);

create table if not exists public.lessons (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses on delete cascade,
  module_id    uuid references public.modules on delete set null,
  title        text not null,
  slug         text not null,
  summary      text not null default '',
  content      text not null default '',   -- markdown
  est_minutes  int  not null default 5,
  xp_reward    int  not null default 20,
  sort_order   int  not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (course_id, slug)
);

create table if not exists public.enrollments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  course_id  uuid not null references public.courses on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.lesson_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles on delete cascade,
  lesson_id    uuid not null references public.lessons on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists public.quizzes (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references public.lessons on delete cascade unique,
  title      text not null default 'Kiểm tra nhanh',
  pass_score int  not null default 70,  -- % để đạt
  xp_reward  int  not null default 30
);

create table if not exists public.quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quizzes on delete cascade,
  prompt        text not null,
  options       jsonb not null default '[]'::jsonb,  -- mảng chuỗi
  correct_index int  not null default 0,
  explanation   text not null default '',
  sort_order    int  not null default 0
);

create table if not exists public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  quiz_id    uuid not null references public.quizzes on delete cascade,
  score      int  not null,   -- số câu đúng
  total      int  not null,   -- tổng câu
  percent    int  not null,
  passed     boolean not null,
  created_at timestamptz not null default now()
);

-- Sổ cái XP — chỉ ghi qua RPC security definer (client không insert trực tiếp).
create table if not exists public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  course_id  uuid references public.courses on delete set null,
  amount     int  not null,
  reason     text not null,   -- 'lesson' | 'lesson_bonus' | 'quiz' | 'quiz_bonus'
  ref_id     uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.streaks (
  user_id          uuid primary key references public.profiles on delete cascade,
  current_streak   int  not null default 0,
  longest_streak   int  not null default 0,
  last_active_date date,
  freezes          int  not null default 2
);

create index if not exists idx_lessons_course on public.lessons(course_id);
create index if not exists idx_xp_user on public.xp_events(user_id);
create index if not exists idx_xp_course_date on public.xp_events(course_id, created_at);
create index if not exists idx_progress_user on public.lesson_progress(user_id);

-- ============================================================
-- TRIGGER: tạo profile khi có user mới
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when new.email = 'ladysfit.mastertrainer@gmail.com'
         then 'coach' else 'learner' end
  )
  on conflict (id) do nothing;

  insert into public.streaks (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RPC: hoàn thành bài học (cộng XP + streak + thưởng biến đổi)
-- ============================================================
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

-- ============================================================
-- RPC: lấy câu hỏi quiz (KHÔNG lộ đáp án đúng)
-- ============================================================
create or replace function public.get_quiz(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz public.quizzes;
  v_qs   jsonb;
begin
  select * into v_quiz from public.quizzes where lesson_id = p_lesson_id;
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

-- ============================================================
-- RPC: nộp quiz (chấm điểm server-side, cộng XP theo năng lực thật)
-- p_answers: jsonb { "<question_id>": <chosen_index> }
-- ============================================================
create or replace function public.submit_quiz(p_lesson_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_quiz    public.quizzes;
  v_lesson  public.lessons;
  v_total   int := 0;
  v_correct int := 0;
  v_percent int;
  v_passed  boolean;
  v_xp      int := 0;
  v_bonus   int := 0;
  r         record;
  v_results jsonb := '[]'::jsonb;
begin
  if v_user is null then raise exception 'Chưa đăng nhập'; end if;

  select * into v_quiz from public.quizzes where lesson_id = p_lesson_id;
  if not found then raise exception 'Bài học chưa có quiz'; end if;
  select * into v_lesson from public.lessons where id = p_lesson_id;

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

  return jsonb_build_object(
    'correct', v_correct, 'total', v_total, 'percent', v_percent,
    'passed', v_passed, 'xp', v_xp, 'bonus', v_bonus, 'results', v_results
  );
end;
$$;

-- ============================================================
-- RPC: bảng xếp hạng cục bộ theo khóa, theo TUẦN (micro-competition)
-- ============================================================
create or replace function public.course_leaderboard(p_course_id uuid)
returns table (user_id uuid, full_name text, xp_week int, rnk int)
language sql
security definer
stable
set search_path = public
as $$
  with wk as (
    select e.user_id,
           coalesce(sum(x.amount) filter (
             where x.created_at >= date_trunc('week', now())
           ), 0)::int as xp_week
    from public.enrollments e
    left join public.xp_events x
      on x.user_id = e.user_id and x.course_id = e.course_id
    where e.course_id = p_course_id
    group by e.user_id
  )
  select wk.user_id, p.full_name, wk.xp_week,
         rank() over (order by wk.xp_week desc)::int as rnk
  from wk
  join public.profiles p on p.id = wk.user_id
  order by wk.xp_week desc, p.full_name;
$$;

-- ============================================================
-- Helper: kiểm tra coach (định nghĩa sau khi đã có bảng profiles)
-- ============================================================
create or replace function public.is_coach()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'coach'
  );
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles        enable row level security;
alter table public.courses         enable row level security;
alter table public.modules         enable row level security;
alter table public.lessons         enable row level security;
alter table public.enrollments     enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quizzes         enable row level security;
alter table public.quiz_questions  enable row level security;
alter table public.quiz_attempts   enable row level security;
alter table public.xp_events       enable row level security;
alter table public.streaks         enable row level security;

-- profiles: ai đăng nhập cũng xem được tên (cho leaderboard); chỉ sửa của mình / coach sửa tất.
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_coach()) with check (id = auth.uid() or public.is_coach());

-- courses
create policy courses_select on public.courses for select to authenticated
  using (published or public.is_coach());
create policy courses_write on public.courses for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- modules
create policy modules_select on public.modules for select to authenticated
  using (public.is_coach() or exists(
    select 1 from public.courses c where c.id = course_id and c.published));
create policy modules_write on public.modules for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- lessons
create policy lessons_select on public.lessons for select to authenticated
  using (public.is_coach() or (published and exists(
    select 1 from public.courses c where c.id = course_id and c.published)));
create policy lessons_write on public.lessons for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- enrollments
create policy enroll_select on public.enrollments for select to authenticated
  using (user_id = auth.uid() or public.is_coach());
create policy enroll_insert on public.enrollments for insert to authenticated
  with check (user_id = auth.uid() or public.is_coach());
create policy enroll_delete on public.enrollments for delete to authenticated
  using (public.is_coach());

-- lesson_progress
create policy progress_select on public.lesson_progress for select to authenticated
  using (user_id = auth.uid() or public.is_coach());
-- (insert chỉ qua RPC complete_lesson)

-- quizzes: chỉ coach đọc bảng gốc; học viên lấy qua get_quiz().
create policy quizzes_coach on public.quizzes for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- quiz_questions: chỉ coach (giấu đáp án khỏi học viên).
create policy questions_coach on public.quiz_questions for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- quiz_attempts: xem của mình / coach.
create policy attempts_select on public.quiz_attempts for select to authenticated
  using (user_id = auth.uid() or public.is_coach());

-- xp_events: xem của mình / coach (insert chỉ qua RPC).
create policy xp_select on public.xp_events for select to authenticated
  using (user_id = auth.uid() or public.is_coach());

-- streaks: xem & sửa của mình / coach.
create policy streaks_select on public.streaks for select to authenticated
  using (user_id = auth.uid() or public.is_coach());
create policy streaks_update on public.streaks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
