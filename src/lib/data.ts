import "server-only";
import { createClient } from "./supabase/server";
import { levelForXp } from "./brand";
import type {
  Course,
  Lesson,
  Module,
  Profile,
  Streak,
  LeaderboardRow,
} from "./supabase/types";

// Tổng quan cho bảng học của học viên.
export async function getLearnerDashboard(userId: string) {
  const supabase = await createClient();

  const [{ data: xp }, { data: streakRow }, { data: enr }] = await Promise.all([
    supabase.from("xp_events").select("amount").eq("user_id", userId),
    supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("enrollments")
      .select("course_id, courses(*)")
      .eq("user_id", userId)
      .eq("status", "approved"),
  ]);

  const totalXp = (xp ?? []).reduce((a, b) => a + (b.amount ?? 0), 0);
  const courses = (enr ?? [])
    .map((e) => e.courses as unknown as Course)
    .filter(Boolean);
  const courseIds = courses.map((c) => c.id);

  let progressByCourse: Record<string, { done: number; total: number }> = {};
  if (courseIds.length) {
    const [{ data: lessons }, { data: prog }] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, course_id")
        .in("course_id", courseIds)
        .eq("published", true),
      supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId),
    ]);
    const doneSet = new Set((prog ?? []).map((p) => p.lesson_id));
    progressByCourse = (lessons ?? []).reduce(
      (acc, l) => {
        const c = (acc[l.course_id] ??= { done: 0, total: 0 });
        c.total += 1;
        if (doneSet.has(l.id)) c.done += 1;
        return acc;
      },
      {} as Record<string, { done: number; total: number }>,
    );
  }

  return {
    totalXp,
    level: levelForXp(totalXp),
    streak: (streakRow as Streak | null) ?? {
      user_id: userId,
      current_streak: 0,
      longest_streak: 0,
      last_active_date: null,
      freezes: 2,
    },
    courses: courses.map((c) => {
      const p = progressByCourse[c.id] ?? { done: 0, total: 0 };
      return {
        course: c,
        done: p.done,
        total: p.total,
        percent: p.total ? p.done / p.total : 0,
      };
    }),
  };
}

export const PAGE_SIZE = 6;

export type CourseFilters = { q?: string; cat?: string; page?: number };

// Danh mục cho học viên: khóa đã publish + lọc + phân trang + trạng thái ghi danh.
export async function getCatalog(userId: string, filters: CourseFilters = {}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("courses")
    .select("*", { count: "exact" })
    .eq("published", true);
  if (filters.cat) query = query.eq("category", filters.cat);
  if (filters.q) query = query.ilike("title", `%${filters.q}%`);

  const [{ data: courses, count }, { data: enr }] = await Promise.all([
    query.order("sort_order").range(from, from + PAGE_SIZE - 1),
    supabase.from("enrollments").select("course_id, status").eq("user_id", userId),
  ]);

  const statusByCourse = new Map(
    (enr ?? []).map((e) => [
      e.course_id,
      e.status as "pending" | "approved" | "failed",
    ]),
  );
  const total = count ?? 0;
  return {
    items: ((courses as Course[]) ?? []).map((c) => ({
      course: c,
      status: statusByCourse.get(c.id) ?? null,
    })),
    page,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// Danh sách khóa cho admin: tất cả khóa + lọc + phân trang.
export async function getAdminCourses(filters: CourseFilters = {}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase.from("courses").select("*", { count: "exact" });
  if (filters.cat) query = query.eq("category", filters.cat);
  if (filters.q) query = query.ilike("title", `%${filters.q}%`);

  const { data, count } = await query
    .order("sort_order")
    .range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  return {
    items: (data as Course[]) ?? [],
    page,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// Chi tiết khóa học cho học viên.
export async function getCourseDetail(slug: string, userId: string) {
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!course) return null;

  const [{ data: modules }, { data: lessons }, { data: prog }, { data: enr }] =
    await Promise.all([
      supabase.from("modules").select("*").eq("course_id", course.id).order("sort_order"),
      supabase
        .from("lessons")
        .select("*")
        .eq("course_id", course.id)
        .eq("published", true)
        .order("sort_order"),
      supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId),
      supabase
        .from("enrollments")
        .select("status")
        .eq("user_id", userId)
        .eq("course_id", course.id)
        .maybeSingle(),
    ]);
  const enrollStatus =
    (enr?.status as "pending" | "approved" | "failed" | undefined) ?? null;

  const lessonList = (lessons as Lesson[]) ?? [];
  const quizLessonIds = new Set<string>();
  if (lessonList.length) {
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("lesson_id")
      .in(
        "lesson_id",
        lessonList.map((l) => l.id),
      );
    (quizzes ?? []).forEach((q) => quizLessonIds.add(q.lesson_id));
  }

  const doneSet = new Set((prog ?? []).map((p) => p.lesson_id));
  const { data: lb } = await supabase.rpc("course_leaderboard", {
    p_course_id: course.id,
  });

  return {
    course: course as Course,
    modules: (modules as Module[]) ?? [],
    lessons: lessonList.map((l) => ({
      lesson: l,
      done: doneSet.has(l.id),
      hasQuiz: quizLessonIds.has(l.id),
    })),
    enrollStatus,
    approved: enrollStatus === "approved",
    done: lessonList.filter((l) => doneSet.has(l.id)).length,
    total: lessonList.length,
    leaderboard: (lb as LeaderboardRow[]) ?? [],
  };
}

// Chi tiết tiến độ một học viên (cho coach).
export async function getLearnerDetail(userId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  const [{ data: xp }, { data: streakRow }, { data: enr }, { data: prog }] =
    await Promise.all([
      supabase.from("xp_events").select("amount").eq("user_id", userId),
      supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("enrollments")
        .select("course_id, created_at, courses(*)")
        .eq("user_id", userId),
      supabase
        .from("lesson_progress")
        .select("lesson_id, completed_at")
        .eq("user_id", userId),
    ]);

  const totalXp = (xp ?? []).reduce((a, b) => a + (b.amount ?? 0), 0);
  const courses = (enr ?? [])
    .map((e) => e.courses as unknown as Course)
    .filter(Boolean);
  const courseIds = courses.map((c) => c.id);
  const doneSet = new Set((prog ?? []).map((p) => p.lesson_id));

  const lessonCount: Record<string, { done: number; total: number }> = {};
  if (courseIds.length) {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, course_id")
      .in("course_id", courseIds)
      .eq("published", true);
    (lessons ?? []).forEach((l) => {
      const c = (lessonCount[l.course_id] ??= { done: 0, total: 0 });
      c.total += 1;
      if (doneSet.has(l.id)) c.done += 1;
    });
  }

  // Điểm quiz: lấy attempt, gắn tên bài học, tính kỷ lục theo từng quiz.
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("quiz_id, percent, passed, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const quizIds = [...new Set((attempts ?? []).map((a) => a.quiz_id))];
  const quizLessonTitle: Record<string, string> = {};
  if (quizIds.length) {
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("id, lesson_id")
      .in("id", quizIds);
    const lessonIds = [...new Set((quizzes ?? []).map((q) => q.lesson_id))];
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, title")
      .in("id", lessonIds);
    const titleById = new Map((lessons ?? []).map((l) => [l.id, l.title]));
    (quizzes ?? []).forEach((q) => {
      quizLessonTitle[q.id] = titleById.get(q.lesson_id) ?? "Bài học";
    });
  }

  const bestByQuiz = new Map<string, { title: string; best: number; attempts: number; passed: boolean }>();
  (attempts ?? []).forEach((a) => {
    const cur = bestByQuiz.get(a.quiz_id);
    if (!cur) {
      bestByQuiz.set(a.quiz_id, {
        title: quizLessonTitle[a.quiz_id] ?? "Bài học",
        best: a.percent,
        attempts: 1,
        passed: a.passed,
      });
    } else {
      cur.attempts += 1;
      cur.best = Math.max(cur.best, a.percent);
      cur.passed = cur.passed || a.passed;
    }
  });

  return {
    profile: profile as Profile,
    totalXp,
    level: levelForXp(totalXp),
    streak: (streakRow as Streak | null) ?? null,
    enrolledAt: (enr ?? []).reduce<Record<string, string>>((acc, e) => {
      acc[e.course_id] = e.created_at;
      return acc;
    }, {}),
    courses: courses.map((c) => {
      const p = lessonCount[c.id] ?? { done: 0, total: 0 };
      return { course: c, done: p.done, total: p.total, percent: p.total ? p.done / p.total : 0 };
    }),
    quizzes: [...bestByQuiz.values()],
    lessonsDone: doneSet.size,
  };
}

// Một bài học + bài kế tiếp.
export async function getLessonView(
  courseSlug: string,
  lessonSlug: string,
  userId: string,
) {
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", courseSlug)
    .maybeSingle();
  if (!course) return null;

  // Chỉ học viên đã được duyệt mới xem được bài.
  const { data: enr } = await supabase
    .from("enrollments")
    .select("status")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .maybeSingle();
  const approved = enr?.status === "approved";
  if (!approved) {
    return { locked: true as const, course: course as Course };
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", course.id)
    .eq("published", true)
    .order("sort_order");

  const list = (lessons as Lesson[]) ?? [];
  const idx = list.findIndex((l) => l.slug === lessonSlug);
  if (idx === -1) return null;
  const lesson = list[idx];

  const [{ data: doneRow }, { data: quiz }, { data: attempts }] =
    await Promise.all([
      supabase
        .from("lesson_progress")
        .select("id")
        .eq("user_id", userId)
        .eq("lesson_id", lesson.id)
        .maybeSingle(),
      supabase.from("quizzes").select("id").eq("lesson_id", lesson.id).maybeSingle(),
      supabase
        .from("quiz_attempts")
        .select("percent, passed")
        .eq("user_id", userId),
    ]);

  let bestPercent: number | null = null;
  if (quiz && attempts) {
    // best attempt cho quiz này (lọc theo quiz_id cần thêm) — đơn giản: lấy theo lesson qua quiz.id
    const { data: a2 } = await supabase
      .from("quiz_attempts")
      .select("percent")
      .eq("user_id", userId)
      .eq("quiz_id", quiz.id);
    if (a2 && a2.length) bestPercent = Math.max(...a2.map((x) => x.percent));
  }

  return {
    locked: false as const,
    course: course as Course,
    lesson,
    done: !!doneRow,
    hasQuiz: !!quiz,
    bestPercent,
    prev: idx > 0 ? list[idx - 1] : null,
    next: idx < list.length - 1 ? list[idx + 1] : null,
  };
}

// ── Admin: theo dõi tiến độ & nhắc nhở học viên nghỉ học ───────

// Số ngày không học sẽ bị đánh dấu "cần nhắc nhở".
export const INACTIVE_DAYS = 3;

// Hôm nay theo UTC (khớp current_date của Postgres trên Supabase).
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Số ngày giữa hai mốc YYYY-MM-DD (toISO - fromISO).
function daysBetween(fromISO: string, toISO: string) {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export interface TrackingRow {
  id: string;
  fullName: string;
  email: string;
  lastActive: string | null; // YYYY-MM-DD, null = chưa học buổi nào
  daysSince: number | null; // số ngày kể từ buổi học gần nhất
  currentStreak: number;
  longestStreak: number;
  needsReminder: boolean;
}

// Bảng theo dõi cho coach: lần học gần nhất, số ngày nghỉ, chuỗi học.
export async function getLearningTracking() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "learner");

  const learners = (profiles as Pick<Profile, "id" | "full_name" | "email">[]) ?? [];
  const ids = learners.map((p) => p.id);

  const { data: streaks } = ids.length
    ? await supabase.from("streaks").select("*").in("user_id", ids)
    : { data: [] };
  const streakByUser = new Map(
    ((streaks as Streak[]) ?? []).map((s) => [s.user_id, s]),
  );

  const today = todayISO();
  const rows: TrackingRow[] = learners.map((p) => {
    const s = streakByUser.get(p.id);
    const lastActive = s?.last_active_date ?? null;
    const daysSince = lastActive ? Math.max(0, daysBetween(lastActive, today)) : null;
    return {
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      lastActive,
      daysSince,
      currentStreak: s?.current_streak ?? 0,
      longestStreak: s?.longest_streak ?? 0,
      needsReminder: daysSince === null || daysSince >= INACTIVE_DAYS,
    };
  });

  // Sắp xếp: cần nhắc lên trước (nghỉ lâu / chưa học nhất), rồi đến người học đều.
  const rank = (r: TrackingRow) => (r.daysSince === null ? Infinity : r.daysSince);
  rows.sort((a, b) => rank(b) - rank(a));

  return {
    rows,
    reminders: rows.filter((r) => r.needsReminder),
    onTrack: rows.filter((r) => !r.needsReminder),
  };
}

// ── Admin: yêu cầu học đang chờ duyệt ─────────────────────────
export async function getPendingRequests() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("id, created_at, user_id, course_id, profiles(full_name, email), courses(title, cover_emoji)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    createdAt: r.created_at as string,
    learner: r.profiles as unknown as { full_name: string; email: string },
    course: r.courses as unknown as { title: string; cover_emoji: string },
  }));
}

export async function getPendingCount() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}
