import "server-only";
import { createClient } from "./supabase/server";
import { levelForXp } from "./brand";
import type {
  Course,
  CourseCategory,
  CourseReview,
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
    const [{ data: lessons }, { data: prog }, { data: ma }, { data: la }] =
      await Promise.all([
        supabase
          .from("lessons")
          .select("id, course_id, module_id")
          .in("course_id", courseIds)
          .eq("published", true),
        supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId),
        supabase.from("module_assignments").select("module_id").eq("user_id", userId),
        supabase.from("lesson_assignments").select("lesson_id").eq("user_id", userId),
      ]);
    const doneSet = new Set((prog ?? []).map((p) => p.lesson_id));
    const asgModules = new Set((ma ?? []).map((r) => r.module_id as string));
    const asgLessons = new Set((la ?? []).map((r) => r.lesson_id as string));
    const lessonRows = (lessons ?? []) as {
      id: string;
      course_id: string;
      module_id: string | null;
    }[];

    // Phân công nội dung: khóa nào bị giới hạn thì chỉ tính bài được gán.
    const restricted = new Set<string>();
    for (const l of lessonRows) {
      if (asgLessons.has(l.id) || (l.module_id && asgModules.has(l.module_id)))
        restricted.add(l.course_id);
    }
    const counted = (l: (typeof lessonRows)[number]) =>
      !restricted.has(l.course_id) ||
      asgLessons.has(l.id) ||
      (!!l.module_id && asgModules.has(l.module_id));

    progressByCourse = lessonRows.filter(counted).reduce(
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

// Danh sách loại khóa học (do coach quản lý).
export async function getCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_categories")
    .select("*")
    .order("sort_order")
    .order("label");
  return (data as CourseCategory[]) ?? [];
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

type DB = Awaited<ReturnType<typeof createClient>>;

// Phân công nội dung (0013): lọc chương / bài theo từng học viên.
// null = học viên KHÔNG bị giới hạn trong khóa này → xem tất cả (mặc định).
// Ngược lại trả bộ id chương / bài mà học viên được xem.
async function contentVisibility(
  supabase: DB,
  userId: string,
  moduleIds: string[],
  lessons: { id: string; module_id: string | null }[],
): Promise<{
  visibleModules: Set<string>;
  visibleLessons: Set<string>;
} | null> {
  const [{ data: ma }, { data: la }] = await Promise.all([
    supabase
      .from("module_assignments")
      .select("module_id")
      .eq("user_id", userId),
    supabase
      .from("lesson_assignments")
      .select("lesson_id")
      .eq("user_id", userId),
  ]);
  const asgModules = new Set((ma ?? []).map((r) => r.module_id as string));
  const asgLessons = new Set((la ?? []).map((r) => r.lesson_id as string));

  // Có giới hạn cho KHÓA này không? (phân công trùng chương/bài của khóa)
  const moduleIdSet = new Set(moduleIds);
  const lessonIdSet = new Set(lessons.map((l) => l.id));
  const restricted =
    [...asgModules].some((id) => moduleIdSet.has(id)) ||
    [...asgLessons].some((id) => lessonIdSet.has(id));
  if (!restricted) return null;

  // Bài được xem: gán trực tiếp HOẶC thuộc chương được gán cả.
  const visibleLessons = new Set(
    lessons
      .filter(
        (l) =>
          asgLessons.has(l.id) || (l.module_id != null && asgModules.has(l.module_id)),
      )
      .map((l) => l.id),
  );
  // Chương được xem: gán cả chương HOẶC còn ít nhất một bài được xem.
  const visibleModules = new Set(
    moduleIds.filter(
      (mid) =>
        asgModules.has(mid) ||
        lessons.some((l) => l.module_id === mid && visibleLessons.has(l.id)),
    ),
  );
  return { visibleModules, visibleLessons };
}

// Tính khóa chương: chương bị khóa nếu có chương TRƯỚC (có quiz) chưa ĐẠT.
async function moduleGating(supabase: DB, userId: string, modules: Module[]) {
  const moduleIds = modules.map((m) => m.id);
  const quizByModule = new Map<string, { id: string; pass_score: number }>();
  if (moduleIds.length) {
    const { data: mq } = await supabase
      .from("quizzes")
      .select("id, module_id, pass_score")
      .in("module_id", moduleIds);
    (mq ?? []).forEach((q) =>
      quizByModule.set(q.module_id as string, {
        id: q.id as string,
        pass_score: q.pass_score as number,
      }),
    );
  }
  const quizIds = [...quizByModule.values()].map((q) => q.id);
  const passedQuiz = new Set<string>();
  if (quizIds.length) {
    const { data: at } = await supabase
      .from("quiz_attempts")
      .select("quiz_id")
      .eq("user_id", userId)
      .eq("passed", true)
      .in("quiz_id", quizIds);
    (at ?? []).forEach((a) => passedQuiz.add(a.quiz_id as string));
  }
  // modules đã sắp theo sort_order: gặp 1 chương có quiz chưa đạt → khóa các chương sau.
  const lockedModules = new Set<string>();
  let blocked = false;
  for (const m of modules) {
    if (blocked) lockedModules.add(m.id);
    const q = quizByModule.get(m.id);
    if (q && !passedQuiz.has(q.id)) blocked = true;
  }
  return { quizByModule, passedQuiz, lockedModules };
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
      supabase
        .from("modules")
        .select("*")
        .eq("course_id", course.id)
        .order("sort_order")
        .order("id"),
      supabase
        .from("lessons")
        .select("*")
        .eq("course_id", course.id)
        .eq("published", true)
        .order("sort_order")
        .order("id"),
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

  const allLessons = (lessons as Lesson[]) ?? [];
  const allModules = (modules as Module[]) ?? [];
  // Phân công nội dung: ẩn hẳn chương/bài không được gán cho học viên này.
  const vis = await contentVisibility(
    supabase,
    userId,
    allModules.map((m) => m.id),
    allLessons,
  );
  const lessonList = vis
    ? allLessons.filter((l) => vis.visibleLessons.has(l.id))
    : allLessons;
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
  const [{ data: lb }, { data: myReview }] = await Promise.all([
    supabase.rpc("course_leaderboard", { p_course_id: course.id }),
    supabase
      .from("course_reviews")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .maybeSingle(),
  ]);

  // Khóa chương + quiz chương (chỉ trên các chương học viên được xem).
  const modList = vis
    ? allModules.filter((m) => vis.visibleModules.has(m.id))
    : allModules;
  const gating = await moduleGating(supabase, userId, modList);

  // Thống kê giới hạn nội dung — để giao diện học viên / bản xem trước giải
  // thích được vì sao chỉ thấy một phần khóa. Chỉ tính chương CÓ bài.
  const hasLessonIn = (mid: string, ls: Lesson[]) =>
    ls.some((l) => l.module_id === mid);
  const totalChapters = allModules.filter((m) =>
    hasLessonIn(m.id, allLessons),
  ).length;
  const visibleChapters = modList.filter((m) =>
    hasLessonIn(m.id, lessonList),
  ).length;

  // Lịch mở khóa theo ngày (chung cho mọi học viên). available_on trống = mở ngay.
  const today = todayISO();
  const isFuture = (d: string | null | undefined) => !!d && d > today;
  const moduleAvail = new Map(modList.map((m) => [m.id, m.available_on ?? null]));

  // Học tuần tự: mọi bài sau bài chưa hoàn thành ĐẦU TIÊN đều bị khóa.
  // (Bài có quiz chỉ được đánh dấu hoàn thành sau khi ĐẠT quiz, nên khóa
  //  theo "done" cũng chính là bắt phải làm và đạt quiz mới qua bài sau.)
  const fiCourse = lessonList.findIndex((l) => !doneSet.has(l.id));
  const firstIncomplete = fiCourse === -1 ? lessonList.length : fiCourse;
  const moduleInfo = modList.map((m) => {
    const mLessons = lessonList.filter((l) => l.module_id === m.id);
    const lessonsTotal = mLessons.length;
    const lessonsDone = mLessons.filter((l) => doneSet.has(l.id)).length;
    const q = gating.quizByModule.get(m.id) ?? null;
    const quizPassed = q ? gating.passedQuiz.has(q.id) : false;
    const locked = gating.lockedModules.has(m.id);
    const dateLocked = isFuture(m.available_on);
    const allLessonsDone = lessonsTotal > 0 && lessonsDone === lessonsTotal;
    return {
      id: m.id,
      locked,
      // Chương chưa tới ngày mở (theo lịch) + ngày mở để hiện cho học viên.
      dateLocked,
      availableOn: dateLocked ? m.available_on : null,
      hasQuiz: !!q,
      quizPassed,
      // Quiz chương mở khi: chương không bị khóa (quiz/lịch), đã học hết bài, chưa đạt.
      quizAvailable:
        !!q && !locked && !dateLocked && allLessonsDone && !quizPassed,
      lessonsDone,
      lessonsTotal,
    };
  });

  return {
    course: course as Course,
    modules: modList,
    moduleInfo,
    lessons: lessonList.map((l, idx) => {
      // Ngày mở hiệu lực = trễ nhất giữa ngày mở của bài và của chương chứa bài
      // (phải qua CẢ HAI mốc mới học được).
      const modDate = l.module_id ? moduleAvail.get(l.module_id) ?? null : null;
      const applicable = [l.available_on, modDate].filter(Boolean) as string[];
      const unlockDate = applicable.length
        ? applicable.reduce((a, b) => (a > b ? a : b))
        : null;
      const dateLocked = isFuture(unlockDate);
      return {
        lesson: l,
        done: doneSet.has(l.id),
        hasQuiz: quizLessonIds.has(l.id),
        locked:
          (l.module_id ? gating.lockedModules.has(l.module_id) : false) ||
          idx > firstIncomplete ||
          dateLocked,
        availableOn: dateLocked ? unlockDate : null,
      };
    }),
    enrollStatus,
    approved: enrollStatus === "approved",
    done: lessonList.filter((l) => doneSet.has(l.id)).length,
    total: lessonList.length,
    // Giới hạn nội dung: học viên này chỉ được mở một phần khóa.
    restricted: !!vis,
    totalChapters,
    visibleChapters,
    hiddenLessonCount: allLessons.length - lessonList.length,
    leaderboard: (lb as LeaderboardRow[]) ?? [],
    myReview: (myReview as CourseReview | null) ?? null,
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

// ── Admin: cây nội dung (chương/bài) + phân công của một học viên ──
export interface ContentCourse {
  id: string;
  title: string;
  cover_emoji: string;
  modules: {
    id: string;
    title: string;
    lessons: { id: string; title: string }[];
  }[];
  ungrouped: { id: string; title: string }[];
  assignedModuleIds: string[];
  assignedLessonIds: string[];
  restricted: boolean; // học viên đang bị giới hạn nội dung ở khóa này?
}

// Trả về từng khóa học viên đã được ghi danh kèm cây chương/bài và trạng thái
// phân công hiện tại — dùng cho khu "Phân chương / bài học" của coach.
export async function getLearnerContentTree(
  userId: string,
): Promise<ContentCourse[]> {
  const supabase = await createClient();
  const { data: enr } = await supabase
    .from("enrollments")
    .select("course_id, courses(id, title, cover_emoji, sort_order)")
    .eq("user_id", userId);
  const courses = (enr ?? [])
    .map((e) => e.courses as unknown as Course)
    .filter(Boolean)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const courseIds = courses.map((c) => c.id);
  if (courseIds.length === 0) return [];

  const [{ data: modules }, { data: lessons }, { data: ma }, { data: la }] =
    await Promise.all([
      supabase
        .from("modules")
        .select("id, course_id, title, sort_order")
        .in("course_id", courseIds)
        .order("sort_order")
        .order("id"),
      supabase
        .from("lessons")
        .select("id, course_id, module_id, title, sort_order")
        .in("course_id", courseIds)
        .eq("published", true)
        .order("sort_order")
        .order("id"),
      supabase.from("module_assignments").select("module_id").eq("user_id", userId),
      supabase.from("lesson_assignments").select("lesson_id").eq("user_id", userId),
    ]);

  const modRows = (modules ?? []) as {
    id: string;
    course_id: string;
    title: string;
  }[];
  const lesRows = (lessons ?? []) as {
    id: string;
    course_id: string;
    module_id: string | null;
    title: string;
  }[];
  const asgModules = new Set((ma ?? []).map((r) => r.module_id as string));
  const asgLessons = new Set((la ?? []).map((r) => r.lesson_id as string));

  return courses.map((c) => {
    const cMods = modRows.filter((m) => m.course_id === c.id);
    const cLessons = lesRows.filter((l) => l.course_id === c.id);
    const modIdSet = new Set(cMods.map((m) => m.id));
    const lesIdSet = new Set(cLessons.map((l) => l.id));
    const assignedModuleIds = [...asgModules].filter((id) => modIdSet.has(id));
    const assignedLessonIds = [...asgLessons].filter((id) => lesIdSet.has(id));
    return {
      id: c.id,
      title: c.title,
      cover_emoji: c.cover_emoji,
      modules: cMods.map((m) => ({
        id: m.id,
        title: m.title,
        lessons: cLessons
          .filter((l) => l.module_id === m.id)
          .map((l) => ({ id: l.id, title: l.title })),
      })),
      ungrouped: cLessons
        .filter((l) => !l.module_id)
        .map((l) => ({ id: l.id, title: l.title })),
      assignedModuleIds,
      assignedLessonIds,
      restricted: assignedModuleIds.length + assignedLessonIds.length > 0,
    };
  });
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
    .order("sort_order")
    .order("id");

  const allList = (lessons as Lesson[]) ?? [];
  // Bài không tồn tại → 404. (Kiểm tra trên toàn bộ trước khi lọc phân công.)
  if (!allList.some((l) => l.slug === lessonSlug)) return null;

  // Khóa chương (chưa đạt quiz chương trước) + tiến độ (để khóa tuần tự).
  const [{ data: modules }, { data: prog }] = await Promise.all([
    supabase
      .from("modules")
      .select("*")
      .eq("course_id", course.id)
      .order("sort_order")
      .order("id"),
    supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId),
  ]);
  const allModules = (modules as Module[]) ?? [];

  // Phân công nội dung: chỉ giữ chương/bài học viên được xem.
  const vis = await contentVisibility(
    supabase,
    userId,
    allModules.map((m) => m.id),
    allList,
  );
  const list = vis ? allList.filter((l) => vis.visibleLessons.has(l.id)) : allList;
  const modList = vis
    ? allModules.filter((m) => vis.visibleModules.has(m.id))
    : allModules;

  const idx = list.findIndex((l) => l.slug === lessonSlug);
  // Bài bị ẩn khỏi học viên (chưa được gán) → coi như khóa.
  if (idx === -1) return { locked: true as const, course: course as Course };
  const lesson = list[idx];

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id")
    .eq("lesson_id", lesson.id)
    .maybeSingle();
  const { lockedModules } = await moduleGating(supabase, userId, modList);
  const doneSet = new Set((prog ?? []).map((p) => p.lesson_id));

  // Lịch mở khóa theo ngày (chung cho mọi học viên).
  const today = todayISO();
  const isFuture = (d: string | null | undefined) => !!d && d > today;
  const moduleAvail = new Map(modList.map((m) => [m.id, m.available_on ?? null]));

  // Học tuần tự: mọi bài sau bài chưa hoàn thành đầu tiên đều bị khóa.
  const fi = list.findIndex((l) => !doneSet.has(l.id));
  const firstIncomplete = fi === -1 ? list.length : fi;
  const isLocked = (i: number) => {
    const les = list[i];
    const m = les.module_id;
    const modDate = m ? moduleAvail.get(m) ?? null : null;
    return (
      (m ? lockedModules.has(m) : false) ||
      i > firstIncomplete ||
      isFuture(les.available_on) ||
      isFuture(modDate)
    );
  };

  // Bài đang xem bị khóa (chưa hoàn thành bài trước) → quay về trang khóa.
  if (isLocked(idx)) {
    return { locked: true as const, course: course as Course };
  }

  let bestPercent: number | null = null;
  let quizPassed = false;
  if (quiz) {
    const { data: a2 } = await supabase
      .from("quiz_attempts")
      .select("percent, passed")
      .eq("user_id", userId)
      .eq("quiz_id", quiz.id);
    if (a2 && a2.length) {
      bestPercent = Math.max(...a2.map((x) => x.percent));
      quizPassed = a2.some((x) => x.passed);
    }
  }

  const hasNext = idx < list.length - 1;
  return {
    locked: false as const,
    course: course as Course,
    lesson,
    done: doneSet.has(lesson.id),
    hasQuiz: !!quiz,
    quizPassed,
    bestPercent,
    prev: idx > 0 ? list[idx - 1] : null,
    next: hasNext ? list[idx + 1] : null,
    // Bài kế bị khóa cho tới khi hoàn thành bài hiện tại (đạt quiz nếu có).
    nextLocked: hasNext ? isLocked(idx + 1) : false,
  };
}

// Trang làm QUIZ CHƯƠNG cho học viên. Trả về { locked } nếu chưa đủ điều kiện.
export async function getModuleQuizView(
  courseSlug: string,
  moduleId: string,
  userId: string,
) {
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", courseSlug)
    .maybeSingle();
  if (!course) return null;

  const { data: enr } = await supabase
    .from("enrollments")
    .select("status")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .maybeSingle();
  if (enr?.status !== "approved") {
    return { locked: true as const, course: course as Course };
  }

  const { data: moduleRow } = await supabase
    .from("modules")
    .select("*")
    .eq("id", moduleId)
    .eq("course_id", course.id)
    .maybeSingle();
  if (!moduleRow) return null;

  const [{ data: modules }, { data: lessons }, { data: prog }, { data: quizRow }] =
    await Promise.all([
      supabase
        .from("modules")
        .select("*")
        .eq("course_id", course.id)
        .order("sort_order")
        .order("id"),
      supabase
        .from("lessons")
        .select("id, module_id")
        .eq("course_id", course.id)
        .eq("published", true),
      supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId),
      supabase.from("quizzes").select("id").eq("module_id", moduleId).maybeSingle(),
    ]);

  const allModules = (modules as Module[]) ?? [];
  const allLessons =
    (lessons as { id: string; module_id: string | null }[]) ?? [];

  // Phân công nội dung: chương bị ẩn khỏi học viên → khóa quiz chương.
  const vis = await contentVisibility(
    supabase,
    userId,
    allModules.map((m) => m.id),
    allLessons,
  );
  if (vis && !vis.visibleModules.has(moduleId)) {
    return { locked: true as const, course: course as Course };
  }
  const modList = vis
    ? allModules.filter((m) => vis.visibleModules.has(m.id))
    : allModules;

  const { lockedModules } = await moduleGating(supabase, userId, modList);
  // Chương chưa tới ngày mở (theo lịch) → khóa quiz chương.
  const modAvailableOn = (moduleRow as Module).available_on;
  const dateLocked = !!modAvailableOn && modAvailableOn > todayISO();
  if (lockedModules.has(moduleId) || dateLocked || !quizRow) {
    return { locked: true as const, course: course as Course };
  }

  // Phải học hết bài (được xem) trong chương mới được làm quiz chương.
  const doneSet = new Set((prog ?? []).map((p) => p.lesson_id));
  const mLessons = allLessons.filter(
    (l) =>
      l.module_id === moduleId &&
      (!vis || vis.visibleLessons.has(l.id)),
  );
  const allDone = mLessons.length > 0 && mLessons.every((l) => doneSet.has(l.id));
  if (!allDone) {
    return { locked: true as const, course: course as Course };
  }

  let bestPercent: number | null = null;
  const { data: a2 } = await supabase
    .from("quiz_attempts")
    .select("percent")
    .eq("user_id", userId)
    .eq("quiz_id", quizRow.id);
  if (a2 && a2.length) bestPercent = Math.max(...a2.map((x) => x.percent));

  return {
    locked: false as const,
    course: course as Course,
    module: moduleRow as Module,
    bestPercent,
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

// ── Admin: đánh giá khóa học của học viên ─────────────────────
export interface ReviewRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  ratings: {
    r_content: number;
    r_coach: number;
    r_difficulty: number;
    r_applicability: number;
    r_overall: number;
  };
  comment: string;
  learner: { full_name: string; email: string };
  course: { title: string; cover_emoji: string; slug: string };
}

export async function getCourseReviews() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_reviews")
    .select(
      "id, created_at, updated_at, r_content, r_coach, r_difficulty, r_applicability, r_overall, comment, profiles(full_name, email), courses(title, cover_emoji, slug)",
    )
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    ratings: {
      r_content: r.r_content as number,
      r_coach: r.r_coach as number,
      r_difficulty: r.r_difficulty as number,
      r_applicability: r.r_applicability as number,
      r_overall: r.r_overall as number,
    },
    comment: r.comment as string,
    learner: r.profiles as unknown as { full_name: string; email: string },
    course: r.courses as unknown as {
      title: string;
      cover_emoji: string;
      slug: string;
    },
  })) as ReviewRow[];
}
