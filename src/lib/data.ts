import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { levelForXp } from "./brand";
import { isMonetized } from "./coins";
import type {
  Course,
  CourseCategory,
  CourseReview,
  Lesson,
  Module,
  Profile,
  Streak,
  LeaderboardRow,
  Payment,
  PaymentEvent,
  CoinSettings,
  CoinPack,
  CoinLedgerRow,
} from "./supabase/types";

// Tổng quan cho bảng học của học viên.
export async function getLearnerDashboard(userId: string) {
  const supabase = await createClient();

  const [{ data: xp }, { data: streakRow }, { data: enr }] = await Promise.all([
    supabase.from("xp_events").select("amount, course_id").eq("user_id", userId),
    supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("enrollments")
      .select("course_id, courses(*)")
      .eq("user_id", userId)
      .eq("status", "approved"),
  ]);

  const totalXp = (xp ?? []).reduce((a, b) => a + (b.amount ?? 0), 0);
  const approvedCourses = (enr ?? [])
    .map((e) => e.courses as unknown as Course)
    .filter(Boolean);

  // Khóa đang HỌC THỬ (chưa ghi danh nhưng đã học ít nhất 1 bài) cũng hiện
  // ở "Tiếp tục học" — không thì học xong phần miễn phí là mất dấu khóa.
  const approvedIds = new Set(approvedCourses.map((c) => c.id));
  const trialIds = [
    ...new Set(
      (xp ?? [])
        .map((x) => x.course_id as string | null)
        .filter((id): id is string => !!id && !approvedIds.has(id)),
    ),
  ];
  let trialCourses: Course[] = [];
  if (trialIds.length) {
    const { data: tc } = await supabase
      .from("courses")
      .select("*")
      .in("id", trialIds)
      .eq("published", true);
    trialCourses = ((tc as Course[]) ?? []).filter(isMonetized);
  }
  const trialSet = new Set(trialCourses.map((c) => c.id));
  const courses = [...approvedCourses, ...trialCourses];
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
        trial: trialSet.has(c.id),
        done: p.done,
        total: p.total,
        percent: p.total ? p.done / p.total : 0,
      };
    }),
  };
}

// Danh sách loại khóa học (do coach quản lý).
// Đây là dữ liệu DÙNG CHUNG cho mọi người và hiếm khi đổi (chỉ khi coach thêm/
// xóa loại) nên được cache: khỏi query lại Supabase ở mỗi trang danh mục / khóa
// học. Làm mới chủ động qua tag "categories" (xem createCategory/deleteCategory),
// kèm revalidate 1 giờ như lưới an toàn. Dùng client service-role (không đọc
// cookie) vì unstable_cache không cho phép chạm request API như cookies().
export const getCategories = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("course_categories")
      .select("*")
      .order("sort_order")
      .order("label");
    return (data as CourseCategory[]) ?? [];
  },
  ["course-categories"],
  { tags: ["categories"], revalidate: 3600 },
);

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

  const [{ data: courses, count }, { data: enr }, { data: pays }] =
    await Promise.all([
      query.order("sort_order").range(from, from + PAGE_SIZE - 1),
      supabase.from("enrollments").select("course_id, status").eq("user_id", userId),
      // Đơn học phí đang mở: để nút hiện "Tiếp tục thanh toán" thay vì sinh
      // thêm mã mới mỗi lần học viên quay lại danh mục.
      supabase
        .from("payments")
        .select("course_id, code, status")
        .eq("user_id", userId)
        .in("status", ["pending", "matched"]),
    ]);

  const statusByCourse = new Map(
    (enr ?? []).map((e) => [
      e.course_id,
      e.status as "pending" | "approved" | "failed",
    ]),
  );
  const payByCourse = new Map(
    (pays ?? []).map((p) => [
      p.course_id as string,
      { code: p.code as string, status: p.status as string },
    ]),
  );
  const total = count ?? 0;
  return {
    items: ((courses as Course[]) ?? []).map((c) => ({
      course: c,
      status: statusByCourse.get(c.id) ?? null,
      payment: payByCourse.get(c.id) ?? null,
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

// Thứ tự bài PHẲNG dùng cho "bài kế / bài trước" và khóa tuần tự: xếp theo
// CHƯƠNG (đúng thứ tự chương) rồi tới thứ tự bài TRONG chương. KHÔNG dựa vào
// sort_order phẳng của bài, vì bài của chương sau có thể mang sort_order chen
// vào giữa các bài của chương trước → "bài kế" nhảy lộn chương và khóa tuần tự
// sai. Bài không thuộc chương nào xếp lên đầu (khớp cách hiển thị).
function orderLessonsByModule(lessons: Lesson[], modules: Module[]): Lesson[] {
  const modRank = new Map(modules.map((m, i) => [m.id, i]));
  const rank = (l: Lesson) =>
    l.module_id ? modRank.get(l.module_id) ?? modules.length : -1;
  return [...lessons].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.sort_order - b.sort_order ||
      a.id.localeCompare(b.id),
  );
}

// Số dư ví xu (0 nếu chưa có ví).
export async function getCoinBalance(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coin_wallets")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.balance as number | undefined) ?? 0;
}

// Bài nào học viên VÀO được (khớp lesson_accessible() trong 0018):
// ghi danh approved → tất cả; failed / khách mời → không bài nào; còn lại
// → N bài học thử đầu khóa + các bài đã mở bằng xu.
// Trả về Set id bài vào được, kèm .free = các bài thuộc phần học thử.
function lessonAccess({
  course,
  enrollStatus,
  isGuest,
  allLessons,
  allModules,
  unlocked,
}: {
  course: Course;
  enrollStatus: "pending" | "approved" | "failed" | null;
  isGuest: boolean;
  allLessons: Lesson[];
  allModules: Module[];
  unlocked: Set<string>;
}) {
  const free = new Set(
    orderLessonsByModule(allLessons, allModules)
      .slice(0, Math.max(0, course.free_lessons ?? 0))
      .map((l) => l.id),
  );
  const ids = new Set<string>();
  if (enrollStatus === "approved") {
    allLessons.forEach((l) => ids.add(l.id));
  } else if (enrollStatus !== "failed" && !isGuest) {
    allLessons.forEach((l) => {
      if (free.has(l.id) || unlocked.has(l.id)) ids.add(l.id);
    });
  }
  return Object.assign(ids, { free });
}

// Chi tiết khóa học cho học viên.
// isGuest: khách mời không học thử / không mở bằng xu (chỉ học khóa được tặng).
export async function getCourseDetail(
  slug: string,
  userId: string,
  isGuest = false,
) {
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!course) return null;

  const [
    { data: modules },
    { data: lessons },
    { data: prog },
    { data: enr },
    { data: unl },
    balance,
    { data: openPay },
  ] = await Promise.all([
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
    supabase.from("lesson_unlocks").select("lesson_id").eq("user_id", userId),
    getCoinBalance(userId),
    // Đơn học phí đang mở → nút "Tiếp tục thanh toán" thay vì sinh mã mới.
    supabase
      .from("payments")
      .select("code, status")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .in("status", ["pending", "matched"])
      .maybeSingle(),
  ]);
  const enrollStatus =
    (enr?.status as "pending" | "approved" | "failed" | undefined) ?? null;

  const allLessons = (lessons as Lesson[]) ?? [];
  const allModules = (modules as Module[]) ?? [];
  const access = lessonAccess({
    course: course as Course,
    enrollStatus,
    isGuest,
    allLessons,
    allModules,
    unlocked: new Set((unl ?? []).map((r) => r.lesson_id as string)),
  });
  // Phân công nội dung: ẩn hẳn chương/bài không được gán cho học viên này.
  const vis = await contentVisibility(
    supabase,
    userId,
    allModules.map((m) => m.id),
    allLessons,
  );
  const lessonList = orderLessonsByModule(
    vis ? allLessons.filter((l) => vis.visibleLessons.has(l.id)) : allLessons,
    allModules,
  );
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

  const approved = enrollStatus === "approved";
  const c = course as Course;
  // Giá mở cả khóa đã trừ xu từng tiêu mở lẻ bài trong khóa này.
  let unlockCost = c.course_coin_price;
  if (!approved && c.course_coin_price > 0) {
    const { data: cost } = await supabase.rpc("course_unlock_cost", {
      p_course_id: c.id,
    });
    if (typeof cost === "number") unlockCost = cost;
  }

  return {
    course: c,
    modules: modList,
    moduleInfo,
    lessons: lessonList.map((l, idx) => {
      // Bài chỉ khóa theo NGÀY của riêng nó — bài không phân ngày thì mở ngay
      // (không thừa kế lịch của chương).
      const dateLocked = isFuture(l.available_on);
      const accessible = access.has(l.id);
      const orderLocked =
        (l.module_id ? gating.lockedModules.has(l.module_id) : false) ||
        idx > firstIncomplete ||
        dateLocked;
      return {
        lesson: l,
        done: doneSet.has(l.id),
        hasQuiz: quizLessonIds.has(l.id),
        // Khóa thật sự: chưa có quyền (chưa mua / ngoài học thử) HOẶC chưa
        // tới lượt (học tuần tự, quiz chương, lịch mở).
        locked: !accessible || orderLocked,
        // Chưa mua nhưng đã TỚI LƯỢT → đây là bài hiện nút "Mở bằng xu".
        paywalled: !accessible,
        unlockable: !accessible && !orderLocked,
        free: access.free.has(l.id) && !approved,
        availableOn: dateLocked ? l.available_on : null,
      };
    }),
    enrollStatus,
    approved,
    // Đang học thử: chưa ghi danh nhưng có ít nhất 1 bài vào được.
    canLearn: approved || access.size > 0,
    balance,
    unlockCost,
    openPayment: (openPay as { code: string; status: string } | null) ?? null,
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
  isGuest = false,
) {
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", courseSlug)
    .maybeSingle();
  if (!course) return null;

  const [
    { data: enr },
    { data: lessons },
    { data: modules },
    { data: prog },
    { data: unl },
  ] = await Promise.all([
    supabase
      .from("enrollments")
      .select("status")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .maybeSingle(),
    supabase
      .from("lessons")
      .select("*")
      .eq("course_id", course.id)
      .eq("published", true)
      .order("sort_order")
      .order("id"),
    supabase
      .from("modules")
      .select("*")
      .eq("course_id", course.id)
      .order("sort_order")
      .order("id"),
    supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId),
    supabase.from("lesson_unlocks").select("lesson_id").eq("user_id", userId),
  ]);
  const enrollStatus =
    (enr?.status as "pending" | "approved" | "failed" | undefined) ?? null;

  const allList = (lessons as Lesson[]) ?? [];
  // Bài không tồn tại → 404. (Kiểm tra trên toàn bộ trước khi lọc phân công.)
  if (!allList.some((l) => l.slug === lessonSlug)) return null;
  const allModules = (modules as Module[]) ?? [];

  // Đã ghi danh → mọi bài; chưa ghi danh → phần học thử + bài đã mở bằng xu.
  const access = lessonAccess({
    course: course as Course,
    enrollStatus,
    isGuest,
    allLessons: allList,
    allModules,
    unlocked: new Set((unl ?? []).map((r) => r.lesson_id as string)),
  });
  if (access.size === 0) {
    return { locked: true as const, course: course as Course };
  }

  // Phân công nội dung: chỉ giữ chương/bài học viên được xem.
  const vis = await contentVisibility(
    supabase,
    userId,
    allModules.map((m) => m.id),
    allList,
  );
  const list = orderLessonsByModule(
    vis ? allList.filter((l) => vis.visibleLessons.has(l.id)) : allList,
    allModules,
  );
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

  // Học tuần tự: mọi bài sau bài chưa hoàn thành đầu tiên đều bị khóa.
  const fi = list.findIndex((l) => !doneSet.has(l.id));
  const firstIncomplete = fi === -1 ? list.length : fi;
  // Khóa theo THỨ TỰ (tuần tự, quiz chương, lịch) — tách khỏi khóa do
  // chưa mua để biết bài kế "tới lượt rồi, chỉ còn thiếu xu".
  const isOrderLocked = (i: number) => {
    const les = list[i];
    const m = les.module_id;
    // Bài chỉ khóa theo NGÀY của riêng nó (không thừa kế lịch của chương).
    return (
      (m ? lockedModules.has(m) : false) ||
      i > firstIncomplete ||
      isFuture(les.available_on)
    );
  };
  const isLocked = (i: number) => isOrderLocked(i) || !access.has(list[i].id);

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
  const next = hasNext ? list[idx + 1] : null;
  const c = course as Course;
  // Bài kế chưa mua: trang bài hiện nút "Mở bài tiếp theo bằng xu" — đúng
  // khoảnh khắc người học đang muốn xem tiếp nhất.
  const nextPaywalled = !!next && !access.has(next.id);
  return {
    locked: false as const,
    course: c,
    nextPaywalled,
    nextOrderLocked: hasNext ? isOrderLocked(idx + 1) : false,
    lessonCoinPrice: c.lesson_coin_price,
    balance: nextPaywalled ? await getCoinBalance(userId) : 0,
    approved: enrollStatus === "approved",
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
  isGuest = false,
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
  // Người học thử cũng làm được quiz chương — không thì quiz chương chặn
  // mất các chương sau dù họ đã mở bài bằng xu. Điều kiện "học hết bài
  // trong chương" bên dưới đã bảo đảm họ thật sự vào được các bài đó.
  if (
    enr?.status === "failed" ||
    (enr?.status !== "approved" && (isGuest || !isMonetized(course as Course)))
  ) {
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

// ── Thanh toán ────────────────────────────────────────────────

// Đơn đang mở, để coach soi và bấm chốt. 'matched' (webhook đã khớp mã)
// xếp trước 'pending' vì đó mới là việc cần làm ngay.
export async function getOpenPayments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, courses(cover_emoji, slug), profiles(full_name)")
    .in("status", ["pending", "matched"])
    .order("status", { ascending: false })
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    ...(r as unknown as Payment),
    course: r.courses as unknown as { cover_emoji: string; slug: string } | null,
    learner: r.profiles as unknown as { full_name: string } | null,
  }));
}

// Số giao dịch đã khớp mã, đang chờ coach bấm. Dùng cho chấm đỏ ở menu.
export async function getMatchedPaymentCount() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("status", "matched");
  return count ?? 0;
}

// Tiền ĐÃ VỀ nhưng hệ thống không khớp được vào đơn nào — học viên gõ sai
// nội dung, chuyển thiếu, hoặc mã đã hết hạn. Đây là việc coach BẮT BUỘC
// phải nhìn: bỏ qua là có người trả tiền mà không được học.
//
// Đọc bằng service role vì payment_events cố ý không mở cho ai.
export async function getUnmatchedTransfers(limit = 50) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payment_events")
    .select("*")
    .in("result", ["no_code", "unknown_code", "expired", "amount_short"])
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as PaymentEvent[];
}

// Đơn đang mở của CHÍNH học viên cho một khóa (hiện mã + số tiền để CK).
export async function getMyOpenPayment(userId: string, courseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .in("status", ["pending", "matched"])
    .maybeSingle();
  return (data as Payment | null) ?? null;
}

// Một đơn theo mã, cho trang thanh toán của học viên. RLS lo phần quyền:
// learner chỉ đọc được đơn của chính mình, coach đọc được tất cả.
export async function getPaymentByCode(code: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, courses(title, slug, cover_emoji)")
    .eq("code", code)
    .maybeSingle();
  if (!data) return null;
  return {
    ...(data as unknown as Payment),
    course: data.courses as unknown as {
      title: string;
      slug: string;
      cover_emoji: string;
    } | null,
  };
}

// ── Xu & nhiệm vụ ────────────────────────────────────────────

// Giá trị mặc định khớp 0018 — dùng khi bảng chưa có (chưa chạy migration)
// để trang không sập.
const DEFAULT_COIN_SETTINGS: CoinSettings = {
  id: 1,
  daily_cap: 30,
  reward_checkin: 5,
  reward_lesson: 10,
  reward_quiz: 5,
  reward_module_quiz: 15,
  reward_streak7: 20,
  reward_review: 10,
  referral_inviter: 50,
  referral_invitee: 30,
  referral_monthly_limit: 10,
  signup_enabled: true,
  updated_at: "",
};

export async function getCoinSettings(): Promise<CoinSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coin_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return (data as CoinSettings | null) ?? DEFAULT_COIN_SETTINGS;
}

// "Hôm nay" theo giờ VN, khớp vn_today() trong DB.
export function vnTodayISO() {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

// Trang Xu & nhiệm vụ của học viên.
export async function getCoinCenter(userId: string) {
  const supabase = await createClient();
  const today = vnTodayISO();
  const [
    settings,
    balance,
    { data: todayRows },
    { data: ledger },
    { data: packs },
    { data: topups },
    { data: me },
    { count: invited },
    { data: streakRow },
  ] = await Promise.all([
    getCoinSettings(),
    getCoinBalance(userId),
    supabase
      .from("coin_ledger")
      .select("amount, kind, capped")
      .eq("user_id", userId)
      .eq("earn_day", today),
    supabase
      .from("coin_ledger")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("coin_packs")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .order("price"),
    supabase
      .from("payments")
      .select("code, status, pack_id, coins, amount")
      .eq("user_id", userId)
      .not("pack_id", "is", null)
      .in("status", ["pending", "matched"]),
    supabase.from("profiles").select("referral_code").eq("id", userId).maybeSingle(),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", userId),
    supabase.from("streaks").select("current_streak").eq("user_id", userId).maybeSingle(),
  ]);

  const rows = (todayRows ?? []) as Pick<CoinLedgerRow, "amount" | "kind" | "capped">[];
  const earnedCapped = rows
    .filter((r) => r.capped)
    .reduce((a, r) => a + r.amount, 0);
  const doneToday = new Set(rows.filter((r) => r.amount > 0).map((r) => r.kind));

  return {
    settings,
    balance,
    earnedCapped,
    checkedIn: doneToday.has("checkin"),
    doneToday,
    streak: (streakRow?.current_streak as number | undefined) ?? 0,
    ledger: (ledger as CoinLedgerRow[]) ?? [],
    packs: (packs as CoinPack[]) ?? [],
    openTopups: (topups ?? []) as {
      code: string;
      status: string;
      pack_id: string;
      coins: number;
      amount: number;
    }[],
    referralCode: (me?.referral_code as string | null) ?? null,
    invited: invited ?? 0,
  };
}

// Trang quản trị Xu: cấu hình + gói nạp + bảng ước tính theo khóa.
export async function getCoinAdmin() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [
    settings,
    { data: packs },
    { data: courses },
    { data: lessons },
    { data: quizzes },
    { data: wallets },
    { data: recent },
    { count: referred },
  ] = await Promise.all([
    getCoinSettings(),
    supabase.from("coin_packs").select("*").order("sort_order").order("price"),
    supabase.from("courses").select("*").order("sort_order"),
    supabase.from("lessons").select("id, course_id").eq("published", true),
    supabase.from("quizzes").select("lesson_id").not("lesson_id", "is", null),
    supabase.from("coin_wallets").select("balance"),
    supabase
      .from("coin_ledger")
      .select("amount, kind")
      .gte("created_at", since),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("referred_by", "is", null),
  ]);

  const lessonCount = new Map<string, number>();
  for (const l of lessons ?? []) {
    const cid = l.course_id as string;
    lessonCount.set(cid, (lessonCount.get(cid) ?? 0) + 1);
  }

  // Tổng 30 ngày theo loại: nhận (+) và tiêu (−).
  const byKind = new Map<string, number>();
  for (const r of recent ?? []) {
    byKind.set(r.kind as string, (byKind.get(r.kind as string) ?? 0) + (r.amount as number));
  }
  const earned30 = [...byKind.entries()]
    .filter(([k]) => k !== "topup" && k !== "admin")
    .reduce((a, [, v]) => a + (v > 0 ? v : 0), 0);
  const spent30 = -[...byKind.values()].reduce((a, v) => a + (v < 0 ? v : 0), 0);

  return {
    settings,
    packs: (packs as CoinPack[]) ?? [],
    courses: ((courses as Course[]) ?? []).map((c) => ({
      course: c,
      lessons: lessonCount.get(c.id) ?? 0,
    })),
    lessonQuizCount: (quizzes ?? []).length,
    stats: {
      circulation: (wallets ?? []).reduce((a, w) => a + (w.balance as number), 0),
      wallets: (wallets ?? []).length,
      earned30,
      spent30,
      topup30: byKind.get("topup") ?? 0,
      referred: referred ?? 0,
    },
  };
}
