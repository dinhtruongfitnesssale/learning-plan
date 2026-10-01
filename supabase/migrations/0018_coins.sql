-- ============================================================
-- Bếp Học — VÍ XU · NHIỆM VỤ · HỌC THỬ · GIỚI THIỆU BẠN BÈ
--
-- Ý tưởng mượn từ app phim ngắn, đổi "xem quảng cáo" thành "học":
--   • Mỗi khóa cho học thử N bài đầu miễn phí (courses.free_lessons).
--   • Bài sau đó mở bằng xu (lesson_coin_price/bài) hoặc mở cả khóa
--     (course_coin_price xu) — hoặc chuyển khoản học phí như 0017.
--   • Xu kiếm bằng nhiệm vụ học tập: điểm danh, học xong bài, đạt quiz,
--     giữ chuỗi 7 ngày, đánh giá khóa, giới thiệu bạn bè.
--   • Xu từ HỌC BÀI + QUIZ bị chặn trần mỗi ngày (coin_settings.daily_cap)
--     → người cày vẫn học hết được nhưng chậm; ai muốn nhanh thì nạp.
--   • Nạp xu = mua gói (coin_packs) qua đúng luồng chuyển khoản 0017.
--
-- Mọi thay đổi số dư đi qua RPC security definer, ghi sổ coin_ledger
-- (chỉ ghi thêm) và khóa dòng ví (FOR UPDATE) để hai request song song
-- không tiêu trùng một đồng xu.
--
-- Chạy SAU 0017_payments.sql.
-- ============================================================

-- "Hôm nay" theo giờ Việt Nam: trần xu và điểm danh reset lúc 0h VN,
-- không phải 7h sáng (0h UTC).
create or replace function public.vn_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::date; $$;

-- ============================================================
-- 1. CẤU HÌNH KHÓA HỌC
-- ============================================================
alter table public.courses
  add column if not exists free_lessons      int not null default 0 check (free_lessons >= 0),
  add column if not exists lesson_coin_price int not null default 0 check (lesson_coin_price >= 0),
  add column if not exists course_coin_price int not null default 0 check (course_coin_price >= 0);

comment on column public.courses.free_lessons is
  'Số bài ĐẦU khóa (theo thứ tự chương → bài) học thử miễn phí, không cần ghi danh.';
comment on column public.courses.lesson_coin_price is
  'Xu để mở lẻ 1 bài. 0 = không bán lẻ từng bài.';
comment on column public.courses.course_coin_price is
  'Xu để mở cả khóa. 0 = không bán cả khóa bằng xu.';

-- ============================================================
-- 2. CẤU HÌNH XU CHUNG (1 dòng duy nhất, coach sửa ở /admin/xu)
-- ============================================================
create table if not exists public.coin_settings (
  id                     int primary key default 1 check (id = 1),
  -- Trần xu/ngày từ học bài + quiz. Đây là "van tốc độ" của người cày.
  daily_cap              int not null default 30 check (daily_cap >= 0),
  reward_checkin         int not null default 5  check (reward_checkin >= 0),
  reward_lesson          int not null default 10 check (reward_lesson >= 0),
  reward_quiz            int not null default 5  check (reward_quiz >= 0),
  reward_module_quiz     int not null default 15 check (reward_module_quiz >= 0),
  reward_streak7         int not null default 20 check (reward_streak7 >= 0),
  reward_review          int not null default 10 check (reward_review >= 0),
  referral_inviter       int not null default 50 check (referral_inviter >= 0),
  referral_invitee       int not null default 30 check (referral_invitee >= 0),
  -- Số lượt thưởng người mời tối đa mỗi tháng (0 = không giới hạn).
  -- Chặn chuyện tự tạo nick ảo để cày xu giới thiệu.
  referral_monthly_limit int not null default 10 check (referral_monthly_limit >= 0),
  -- Cho phép tự đăng ký tài khoản qua link giới thiệu.
  signup_enabled         boolean not null default true,
  updated_at             timestamptz not null default now()
);
insert into public.coin_settings (id) values (1) on conflict (id) do nothing;

alter table public.coin_settings enable row level security;
drop policy if exists coin_settings_select on public.coin_settings;
create policy coin_settings_select on public.coin_settings for select to authenticated
  using (true);
drop policy if exists coin_settings_update on public.coin_settings;
create policy coin_settings_update on public.coin_settings for update to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- ============================================================
-- 3. VÍ + SỔ XU
-- ============================================================
create table if not exists public.coin_wallets (
  user_id    uuid primary key references public.profiles on delete cascade,
  -- check >= 0: lớp chặn cuối, kể cả khi RPC có bug cũng không âm ví.
  balance    int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.coin_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  amount     int  not null check (amount <> 0),   -- + nhận, − tiêu
  -- checkin | lesson | quiz | module_quiz | streak | review
  -- referral_inviter | referral_invitee | topup | admin
  -- unlock_lesson | unlock_course
  kind       text not null,
  -- Khóa chống cộng trùng: cùng (user, kind, ref_key) chỉ cộng 1 lần.
  ref_key    text,
  course_id  uuid references public.courses on delete set null,
  note       text not null default '',
  -- true = tính vào trần ngày (học bài + quiz).
  capped     boolean not null default false,
  earn_day   date not null default public.vn_today(),
  created_at timestamptz not null default now()
);

create unique index if not exists coin_ledger_once_idx
  on public.coin_ledger (user_id, kind, ref_key) where ref_key is not null;
create index if not exists coin_ledger_user_idx
  on public.coin_ledger (user_id, created_at desc);
create index if not exists coin_ledger_day_idx
  on public.coin_ledger (user_id, earn_day) where capped;

alter table public.coin_wallets enable row level security;
alter table public.coin_ledger  enable row level security;

drop policy if exists coin_wallets_select on public.coin_wallets;
create policy coin_wallets_select on public.coin_wallets for select to authenticated
  using (user_id = auth.uid() or public.is_coach());
drop policy if exists coin_ledger_select on public.coin_ledger;
create policy coin_ledger_select on public.coin_ledger for select to authenticated
  using (user_id = auth.uid() or public.is_coach());
-- CỐ Ý không có policy ghi: số dư chỉ đổi qua RPC bên dưới.

-- Bài đã mở lẻ bằng xu.
create table if not exists public.lesson_unlocks (
  user_id    uuid not null references public.profiles on delete cascade,
  lesson_id  uuid not null references public.lessons  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.lesson_unlocks enable row level security;
drop policy if exists lesson_unlocks_select on public.lesson_unlocks;
create policy lesson_unlocks_select on public.lesson_unlocks for select to authenticated
  using (user_id = auth.uid() or public.is_coach());

-- ============================================================
-- 4. CỘNG / TRỪ XU (nội bộ — không cho client gọi)
-- ============================================================
-- Trả về số xu THỰC cộng (có thể < p_amount do chạm trần, 0 nếu đã cộng
-- rồi hoặc hết trần).
create or replace function public._award_coins(
  p_user    uuid,
  p_kind    text,
  p_ref     text,
  p_amount  int,
  p_capped  boolean,
  p_course  uuid default null,
  p_note    text default ''
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap   int;
  v_today int;
  v_amt   int := coalesce(p_amount, 0);
begin
  if p_user is null or v_amt <= 0 then return 0; end if;

  insert into public.coin_wallets (user_id) values (p_user)
    on conflict (user_id) do nothing;
  perform 1 from public.coin_wallets where user_id = p_user for update;

  if p_ref is not null and exists (
    select 1 from public.coin_ledger
    where user_id = p_user and kind = p_kind and ref_key = p_ref
  ) then
    return 0;
  end if;

  if p_capped then
    select daily_cap into v_cap from public.coin_settings where id = 1;
    select coalesce(sum(amount), 0) into v_today
      from public.coin_ledger
      where user_id = p_user and capped and earn_day = public.vn_today();
    v_amt := least(v_amt, greatest(coalesce(v_cap, 0) - v_today, 0));
    if v_amt <= 0 then return 0; end if;
  end if;

  insert into public.coin_ledger
    (user_id, amount, kind, ref_key, course_id, note, capped)
  values
    (p_user, v_amt, p_kind, p_ref, p_course, coalesce(p_note, ''), p_capped);
  update public.coin_wallets
    set balance = balance + v_amt, updated_at = now()
    where user_id = p_user;
  return v_amt;
end; $$;

create or replace function public._spend_coins(
  p_user   uuid,
  p_amount int,
  p_kind   text,
  p_course uuid,
  p_note   text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal int;
begin
  if p_amount <= 0 then
    select balance into v_bal from public.coin_wallets where user_id = p_user;
    return coalesce(v_bal, 0);
  end if;
  insert into public.coin_wallets (user_id) values (p_user)
    on conflict (user_id) do nothing;
  select balance into v_bal from public.coin_wallets
    where user_id = p_user for update;
  if v_bal < p_amount then
    raise exception 'Không đủ xu (cần %, đang có %)', p_amount, v_bal;
  end if;
  insert into public.coin_ledger (user_id, amount, kind, course_id, note)
  values (p_user, -p_amount, p_kind, p_course, coalesce(p_note, ''));
  update public.coin_wallets
    set balance = balance - p_amount, updated_at = now()
    where user_id = p_user;
  return v_bal - p_amount;
end; $$;

revoke all on function public._award_coins(uuid, text, text, int, boolean, uuid, text)
  from public, anon, authenticated;
revoke all on function public._spend_coins(uuid, int, text, uuid, text)
  from public, anon, authenticated;

-- ============================================================
-- 5. QUYỀN VÀO MỘT BÀI HỌC
-- ============================================================
-- true khi: coach · ghi danh 'approved' · bài đã mở bằng xu · hoặc bài
-- nằm trong N bài học thử đầu khóa. Ghi danh 'failed' (khóa do fail
-- quiz) và khách mời thì chỉ tính ghi danh.
--
-- Thứ tự bài khớp orderLessonsByModule() bên app: bài lẻ (không chương)
-- trước, rồi theo thứ tự chương, rồi thứ tự bài trong chương.
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

revoke all on function public.lesson_accessible(uuid, uuid) from public, anon;
grant execute on function public.lesson_accessible(uuid, uuid) to authenticated;

-- ============================================================
-- 6. GIỚI THIỆU BẠN BÈ
-- ============================================================
alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by   uuid references public.profiles on delete set null;
create unique index if not exists profiles_referral_code_idx
  on public.profiles (referral_code) where referral_code is not null;

create or replace function public._new_referral_code()
returns text
language plpgsql
set search_path = public
as $$
declare v text;
begin
  -- 6 ký tự, bỏ 0/O/1/I cho khỏi đọc nhầm khi đọc mã qua điện thoại.
  loop
    v := translate(upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
                   '01', '89');
    exit when not exists (select 1 from public.profiles where referral_code = v);
  end loop;
  return v;
end; $$;

-- Mọi profile mới tự có mã.
create or replace function public._profiles_set_referral_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.referral_code is null then
    new.referral_code := public._new_referral_code();
  end if;
  return new;
end; $$;

drop trigger if exists profiles_referral_code on public.profiles;
create trigger profiles_referral_code
  before insert on public.profiles
  for each row execute function public._profiles_set_referral_code();

-- Cấp mã cho người cũ (từng dòng để vòng lặp chống trùng thấy mã vừa cấp).
do $$
declare r record;
begin
  for r in select id from public.profiles where referral_code is null loop
    update public.profiles set referral_code = public._new_referral_code()
      where id = r.id;
  end loop;
end $$;

-- Gắn người mời cho tài khoản MỚI và tặng xu chào mừng. Chỉ gọi từ
-- server (service_role) ngay sau khi tạo tài khoản ở trang /dang-ky.
create or replace function public.apply_referral(p_user uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter uuid;
  v_bonus   int;
begin
  select id into v_inviter from public.profiles
    where referral_code = upper(trim(coalesce(p_code, '')));
  if v_inviter is null or v_inviter = p_user then return false; end if;

  update public.profiles set referred_by = v_inviter
    where id = p_user and referred_by is null;
  if not found then return false; end if;

  select referral_invitee into v_bonus from public.coin_settings where id = 1;
  perform public._award_coins(p_user, 'referral_invitee', 'ref:' || p_user,
                              v_bonus, false, null, 'Quà chào mừng bạn mới');
  return true;
end; $$;
revoke all on function public.apply_referral(uuid, text) from public, anon, authenticated;

-- Người mời nhận thưởng khi bạn được mời HOÀN THÀNH BÀI ĐẦU TIÊN — không
-- phải lúc đăng ký, để nick ảo lập ra rồi bỏ đó không đẻ ra xu.
create or replace function public._reward_referrer(p_invitee uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter uuid;
  v_name    text;
  s         public.coin_settings;
  v_month   int;
begin
  select referred_by, coalesce(nullif(full_name, ''), email)
    into v_inviter, v_name
    from public.profiles where id = p_invitee;
  if v_inviter is null then return 0; end if;

  select * into s from public.coin_settings where id = 1;
  if s.referral_monthly_limit > 0 then
    select count(*) into v_month from public.coin_ledger
      where user_id = v_inviter and kind = 'referral_inviter'
        and earn_day >= date_trunc('month', public.vn_today())::date;
    if v_month >= s.referral_monthly_limit then return 0; end if;
  end if;

  return public._award_coins(v_inviter, 'referral_inviter', 'ref:' || p_invitee,
                             s.referral_inviter, false, null,
                             'Bạn ' || coalesce(v_name, '') || ' đã học bài đầu tiên');
end; $$;
revoke all on function public._reward_referrer(uuid) from public, anon, authenticated;

-- ============================================================
-- 7. complete_lesson: thêm KIỂM TRA QUYỀN + THƯỞNG XU
-- ============================================================
-- Giữ nguyên toàn bộ logic 0013 (phân công, lịch mở, đạt quiz, XP,
-- streak). Thêm:
--   • lesson_accessible(): chặn hoàn thành bài chưa mở — trước đây RPC
--     không kiểm tra ghi danh, giờ hoàn thành bài ra xu nên phải chặn.
--   • Xu học bài (tính trần ngày) + xu mốc chuỗi 7 ngày + thưởng người mời.
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
  v_prev     int;
  v_cfg      public.coin_settings;
  v_coins    int := 0;
  v_scoins   int := 0;
begin
  if v_user is null then raise exception 'Chưa đăng nhập'; end if;

  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found then raise exception 'Không thấy bài học'; end if;

  select exists(
    select 1 from public.lesson_progress
    where user_id = v_user and lesson_id = p_lesson_id
  ) into v_already;

  if v_already then
    return jsonb_build_object('already', true, 'xp', 0, 'bonus', 0, 'coins', 0);
  end if;

  -- Chưa ghi danh / chưa mở bằng xu / ngoài phần học thử → chặn.
  if not public.lesson_accessible(v_user, p_lesson_id) then
    raise exception 'Bài học chưa được mở cho bạn';
  end if;

  -- Bài chưa được gán cho học viên (phân công nội dung) → chặn.
  if public.content_hidden(v_user, p_lesson_id) then
    raise exception 'Bài học chưa được mở cho bạn';
  end if;

  if v_lesson.available_on is not null and v_lesson.available_on > v_today then
    raise exception 'Bài học chưa tới ngày mở';
  end if;
  if v_lesson.module_id is not null then
    select available_on into v_mod_date
      from public.modules where id = v_lesson.module_id;
    if v_mod_date is not null and v_mod_date > v_today then
      raise exception 'Chương chưa tới ngày mở';
    end if;
  end if;

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
  v_bonus := floor(random() * 16)::int;

  insert into public.xp_events (user_id, course_id, amount, reason, ref_id)
  values (v_user, v_lesson.course_id, v_base, 'lesson', p_lesson_id);
  if v_bonus > 0 then
    insert into public.xp_events (user_id, course_id, amount, reason, ref_id)
    values (v_user, v_lesson.course_id, v_bonus, 'lesson_bonus', p_lesson_id);
  end if;

  select * into s from public.streaks where user_id = v_user for update;
  v_prev := coalesce(s.current_streak, 0);
  if s.last_active_date is null then
    s.current_streak := 1;
  elsif s.last_active_date = v_today then
    null;
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

  -- ── Xu ──
  select * into v_cfg from public.coin_settings where id = 1;
  v_coins := public._award_coins(v_user, 'lesson', 'lesson:' || p_lesson_id,
                                 v_cfg.reward_lesson, true, v_lesson.course_id,
                                 v_lesson.title);
  -- Chạm mốc 7, 14, 21… ngày liên tiếp (chỉ khi chuỗi vừa tăng).
  if s.current_streak > v_prev and s.current_streak % 7 = 0 then
    v_scoins := public._award_coins(v_user, 'streak', 'streak:' || v_today,
                                    v_cfg.reward_streak7, false, null,
                                    'Chuỗi ' || s.current_streak || ' ngày');
  end if;
  -- Bài đầu tiên trong đời của người được giới thiệu → thưởng người mời.
  if not exists (select 1 from public.lesson_progress
                 where user_id = v_user and lesson_id <> p_lesson_id) then
    perform public._reward_referrer(v_user);
  end if;

  return jsonb_build_object(
    'already', false,
    'xp', v_base,
    'bonus', v_bonus,
    'streak', s.current_streak,
    'coins', v_coins,
    'streak_coins', v_scoins,
    'cap_reached', v_coins < v_cfg.reward_lesson
  );
end;
$$;

-- ============================================================
-- 8. XU TỪ QUIZ (trigger — khỏi phải viết lại submit_quiz)
-- ============================================================
-- Chỉ lần ĐẠT ĐẦU TIÊN mỗi quiz (ref_key), chỉ khi học viên thật sự có
-- quyền vào bài/chương đó — nộp quiz khóa người khác không ra xu.
create or replace function public._quiz_coins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q       public.quizzes;
  v_cfg   public.coin_settings;
  v_course uuid;
begin
  if not new.passed then return new; end if;
  select * into q from public.quizzes where id = new.quiz_id;
  if not found then return new; end if;
  select * into v_cfg from public.coin_settings where id = 1;

  if q.lesson_id is not null then
    if public.lesson_accessible(new.user_id, q.lesson_id) then
      select course_id into v_course from public.lessons where id = q.lesson_id;
      perform public._award_coins(new.user_id, 'quiz', 'quiz:' || q.id,
                                  v_cfg.reward_quiz, true, v_course, 'Đạt quiz bài');
    end if;
  elsif q.module_id is not null then
    select course_id into v_course from public.modules where id = q.module_id;
    if exists (select 1 from public.lessons
               where module_id = q.module_id and published)
       and not exists (select 1 from public.lessons
                       where module_id = q.module_id and published
                         and not public.lesson_accessible(new.user_id, id)) then
      perform public._award_coins(new.user_id, 'module_quiz', 'quiz:' || q.id,
                                  v_cfg.reward_module_quiz, true, v_course,
                                  'Đạt quiz chương');
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists quiz_attempts_coins on public.quiz_attempts;
create trigger quiz_attempts_coins
  after insert on public.quiz_attempts
  for each row execute function public._quiz_coins();

-- Xu đánh giá khóa (mỗi khóa 1 lần).
create or replace function public._review_coins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_amt int;
begin
  select reward_review into v_amt from public.coin_settings where id = 1;
  perform public._award_coins(new.user_id, 'review', 'review:' || new.course_id,
                              v_amt, false, new.course_id, 'Đánh giá khóa học');
  return new;
end; $$;

drop trigger if exists course_reviews_coins on public.course_reviews;
create trigger course_reviews_coins
  after insert on public.course_reviews
  for each row execute function public._review_coins();

-- ============================================================
-- 9. RPC HỌC VIÊN
-- ============================================================
create or replace function public.claim_daily_checkin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_amt  int;
  v_got  int;
begin
  if v_user is null then raise exception 'Chưa đăng nhập'; end if;
  if public.is_guest() then
    raise exception 'Tài khoản khách mời không dùng ví xu';
  end if;
  select reward_checkin into v_amt from public.coin_settings where id = 1;
  v_got := public._award_coins(v_user, 'checkin', 'checkin:' || public.vn_today(),
                               v_amt, false, null, 'Điểm danh');
  return jsonb_build_object('coins', v_got, 'already', v_got = 0);
end; $$;
revoke all on function public.claim_daily_checkin() from public, anon;
grant execute on function public.claim_daily_checkin() to authenticated;

create or replace function public.unlock_lesson(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_lesson public.lessons;
  v_course public.courses;
  v_bal    int;
begin
  if v_user is null then raise exception 'Chưa đăng nhập'; end if;
  if public.is_guest() then
    raise exception 'Tài khoản khách mời cần liên hệ admin để được mở khóa học';
  end if;

  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found or not v_lesson.published then raise exception 'Không thấy bài học'; end if;
  select * into v_course from public.courses where id = v_lesson.course_id;
  if not v_course.published then raise exception 'Khóa học không tồn tại'; end if;
  if v_course.lesson_coin_price <= 0 then
    raise exception 'Khóa này không mở lẻ từng bài bằng xu';
  end if;
  if exists (select 1 from public.enrollments
             where user_id = v_user and course_id = v_course.id and status = 'failed') then
    raise exception 'Khóa học đang bị khóa do làm sai quiz quá số lần — hãy yêu cầu học lại';
  end if;

  -- Khóa ví TRƯỚC khi kiểm tra "đã mở chưa": bấm 2 lần liền không trừ 2 lần.
  insert into public.coin_wallets (user_id) values (v_user) on conflict do nothing;
  perform 1 from public.coin_wallets where user_id = v_user for update;

  if public.lesson_accessible(v_user, p_lesson_id) then
    select balance into v_bal from public.coin_wallets where user_id = v_user;
    return jsonb_build_object('already', true, 'balance', v_bal);
  end if;

  v_bal := public._spend_coins(v_user, v_course.lesson_coin_price, 'unlock_lesson',
                               v_course.id, v_lesson.title);
  insert into public.lesson_unlocks (user_id, lesson_id) values (v_user, p_lesson_id)
    on conflict do nothing;
  return jsonb_build_object('already', false, 'spent', v_course.lesson_coin_price,
                            'balance', v_bal);
end; $$;
revoke all on function public.unlock_lesson(uuid) from public, anon;
grant execute on function public.unlock_lesson(uuid) to authenticated;

-- Giá mở cả khóa sau khi trừ số xu ĐÃ tiêu mở lẻ bài trong khóa đó — mở
-- lẻ vài bài rồi mới quyết mua cả khóa thì không bị mất tiền oan.
create or replace function public.course_unlock_cost(p_course_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    c.course_coin_price - coalesce((
      select -sum(amount) from public.coin_ledger
      where user_id = auth.uid() and course_id = p_course_id
        and kind = 'unlock_lesson'
    ), 0),
    0)::int
  from public.courses c where c.id = p_course_id;
$$;
revoke all on function public.course_unlock_cost(uuid) from public, anon;
grant execute on function public.course_unlock_cost(uuid) to authenticated;

create or replace function public.unlock_course(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_course public.courses;
  v_status text;
  v_cost   int;
  v_bal    int;
begin
  if v_user is null then raise exception 'Chưa đăng nhập'; end if;
  if public.is_guest() then
    raise exception 'Tài khoản khách mời cần liên hệ admin để được mở khóa học';
  end if;
  select * into v_course from public.courses where id = p_course_id;
  if not found or not v_course.published then raise exception 'Khóa học không tồn tại'; end if;
  if v_course.course_coin_price <= 0 then
    raise exception 'Khóa này không mở bằng xu';
  end if;

  insert into public.coin_wallets (user_id) values (v_user) on conflict do nothing;
  perform 1 from public.coin_wallets where user_id = v_user for update;

  select status into v_status from public.enrollments
    where user_id = v_user and course_id = p_course_id;
  if v_status = 'approved' then
    return jsonb_build_object('already', true);
  end if;
  if v_status = 'failed' then
    raise exception 'Khóa học đang bị khóa do làm sai quiz quá số lần — hãy yêu cầu học lại';
  end if;

  v_cost := public.course_unlock_cost(p_course_id);
  v_bal  := public._spend_coins(v_user, v_cost, 'unlock_course', p_course_id,
                                v_course.title);

  insert into public.enrollments (user_id, course_id, status, attempts_reset_at)
  values (v_user, p_course_id, 'approved', now())
  on conflict (user_id, course_id)
    do update set status = 'approved', attempts_reset_at = now();

  return jsonb_build_object('already', false, 'spent', v_cost, 'balance', v_bal);
end; $$;
revoke all on function public.unlock_course(uuid) from public, anon;
grant execute on function public.unlock_course(uuid) to authenticated;

-- ============================================================
-- 10. GÓI NẠP XU (đi qua luồng chuyển khoản 0017)
-- ============================================================
create table if not exists public.coin_packs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  price      int  not null check (price > 0),       -- VND
  coins      int  not null check (coins > 0),
  bonus      int  not null default 0 check (bonus >= 0),  -- xu tặng thêm
  active     boolean not null default true,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
alter table public.coin_packs enable row level security;
drop policy if exists coin_packs_select on public.coin_packs;
create policy coin_packs_select on public.coin_packs for select to authenticated
  using (active or public.is_coach());
drop policy if exists coin_packs_write on public.coin_packs;
create policy coin_packs_write on public.coin_packs for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- Đơn nạp xu = đơn payments có pack_id; coins chốt TẠI LÚC tạo đơn (đổi
-- gói về sau không đổi đơn cũ, xóa gói cũng không mất số xu phải cộng).
alter table public.payments
  add column if not exists pack_id uuid references public.coin_packs on delete set null,
  add column if not exists coins   int  not null default 0 check (coins >= 0);

create unique index if not exists payments_one_open_pack_idx
  on public.payments (user_id, pack_id)
  where status in ('pending', 'matched') and pack_id is not null;

create or replace function public.create_topup_intent(p_pack_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_pack  public.coin_packs;
  v_pay   public.payments;
  v_email text;
  v_code  text;
begin
  if v_user is null then raise exception 'Chưa đăng nhập'; end if;
  if public.is_guest() then
    raise exception 'Tài khoản khách mời không dùng ví xu';
  end if;
  select * into v_pack from public.coin_packs where id = p_pack_id;
  if not found or not v_pack.active then raise exception 'Gói xu không tồn tại'; end if;

  update public.payments set status = 'expired'
    where user_id = v_user and pack_id = p_pack_id
      and status = 'pending' and expires_at < now();

  select * into v_pay from public.payments
    where user_id = v_user and pack_id = p_pack_id
      and status in ('pending', 'matched')
    limit 1;
  if found then return v_pay; end if;

  select email into v_email from public.profiles where id = v_user;
  loop
    v_code := 'BH' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.payments where code = v_code);
  end loop;

  insert into public.payments
    (code, user_id, course_id, pack_id, coins, user_email, course_title, amount)
  values
    (v_code, v_user, null, v_pack.id, v_pack.coins + v_pack.bonus,
     coalesce(v_email, ''),
     'Nạp ' || (v_pack.coins + v_pack.bonus) || ' xu · ' || v_pack.name,
     v_pack.price)
  returning * into v_pay;
  return v_pay;
end; $$;
revoke all on function public.create_topup_intent(uuid) from public;
grant execute on function public.create_topup_intent(uuid) to authenticated;

-- confirm_payment: thêm nhánh NẠP XU. Đơn khóa học giữ nguyên như 0017.
create or replace function public.confirm_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payments;
  v_me  uuid := auth.uid();
  v_kind text;
begin
  if not public.is_coach() then raise exception 'Không có quyền'; end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Không tìm thấy giao dịch'; end if;
  v_kind := case when v_pay.coins > 0 then 'topup' else 'course' end;

  if v_pay.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'already', true, 'kind', v_kind,
                              'user_id', v_pay.user_id,
                              'course_id', v_pay.course_id,
                              'coins', v_pay.coins);
  end if;
  if v_pay.status not in ('pending', 'matched') then
    raise exception 'Giao dịch đã đóng (%)', v_pay.status;
  end if;
  if v_pay.user_id is null then
    raise exception 'Học viên đã bị xóa';
  end if;

  if v_kind = 'topup' then
    perform public._award_coins(v_pay.user_id, 'topup', 'payment:' || v_pay.id,
                                v_pay.coins, false, null, v_pay.course_title);
  else
    if v_pay.course_id is null then
      raise exception 'Khóa học đã bị xóa';
    end if;
    insert into public.enrollments (user_id, course_id, status, attempts_reset_at)
    values (v_pay.user_id, v_pay.course_id, 'approved', now())
    on conflict (user_id, course_id)
      do update set status = 'approved', attempts_reset_at = now();
  end if;

  update public.payments
    set status = 'confirmed', confirmed_at = now(), confirmed_by = v_me
    where id = v_pay.id;

  return jsonb_build_object('ok', true, 'already', false, 'kind', v_kind,
                            'user_id', v_pay.user_id,
                            'course_id', v_pay.course_id,
                            'coins', v_pay.coins);
end; $$;

-- ============================================================
-- 11. COACH TẶNG / TRỪ XU TAY (hỗ trợ, bù lỗi, thưởng sự kiện)
-- ============================================================
create or replace function public.admin_adjust_coins(
  p_user uuid, p_amount int, p_note text default ''
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_bal int;
begin
  if not public.is_coach() then raise exception 'Không có quyền'; end if;
  if coalesce(p_amount, 0) = 0 then raise exception 'Số xu phải khác 0'; end if;

  insert into public.coin_wallets (user_id) values (p_user) on conflict do nothing;
  select balance into v_bal from public.coin_wallets where user_id = p_user for update;
  if v_bal + p_amount < 0 then
    raise exception 'Ví chỉ còn % xu, không trừ được %', v_bal, -p_amount;
  end if;
  insert into public.coin_ledger (user_id, amount, kind, note)
  values (p_user, p_amount, 'admin', coalesce(nullif(trim(p_note), ''), 'Coach điều chỉnh'));
  update public.coin_wallets set balance = balance + p_amount, updated_at = now()
    where user_id = p_user;
  return v_bal + p_amount;
end; $$;
revoke all on function public.admin_adjust_coins(uuid, int, text) from public, anon;
grant execute on function public.admin_adjust_coins(uuid, int, text) to authenticated;
