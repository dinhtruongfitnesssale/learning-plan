"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCoach } from "@/lib/auth";
import { slugify, tempPassword } from "@/lib/slug";

// Mọi action đều kiểm tra coach (RLS cũng chặn, đây là lớp phòng vệ thứ hai).
async function guard() {
  await requireCoach();
  return createClient();
}

// ── Khóa học ──────────────────────────────────────────────────
export async function createCourse(formData: FormData) {
  const supabase = await guard();
  const title = String(formData.get("title")).trim();
  if (!title) return;
  const { data } = await supabase
    .from("courses")
    .insert({
      title,
      slug: slugify(title) || `khoa-${Date.now()}`,
      summary: String(formData.get("summary") ?? ""),
      cover_emoji: String(formData.get("cover_emoji") || "🍲"),
      accent: (String(formData.get("accent")) || "amber") as
        | "amber"
        | "herb"
        | "slate"
        | "clay",
      category: String(formData.get("category")) || "dinh_duong",
    })
    .select("id, slug")
    .single();
  revalidatePath("/admin/khoa-hoc");
  if (data) redirect(`/admin/khoa-hoc/${data.slug}`);
}

export async function updateCourse(formData: FormData) {
  const supabase = await guard();
  const id = String(formData.get("id"));
  const slug = String(formData.get("slug"));
  await supabase
    .from("courses")
    .update({
      title: String(formData.get("title")),
      summary: String(formData.get("summary") ?? ""),
      cover_emoji: String(formData.get("cover_emoji") || "🍲"),
      accent: String(formData.get("accent")) as
        | "amber"
        | "herb"
        | "slate"
        | "clay",
      category: String(formData.get("category")),
    })
    .eq("id", id);
  revalidatePath(`/admin/khoa-hoc/${slug}`);
}

// ── Loại khóa học ─────────────────────────────────────────────
export async function createCategory(formData: FormData) {
  const supabase = await guard();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;
  const emoji = String(formData.get("emoji") ?? "").trim();
  const accent = (String(formData.get("accent")) || "amber") as
    | "amber"
    | "herb"
    | "slate"
    | "clay";

  // Slug duy nhất từ tên loại.
  const base = slugify(label) || `loai-${Date.now()}`;
  let slug = base;
  for (let i = 2; ; i++) {
    const { data: dup } = await supabase
      .from("course_categories")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!dup) break;
    slug = `${base}-${i}`;
  }

  const { count } = await supabase
    .from("course_categories")
    .select("id", { count: "exact", head: true });
  await supabase
    .from("course_categories")
    .insert({ slug, label, emoji, accent, sort_order: count ?? 0 });
  revalidatePath("/admin/khoa-hoc");
}

export async function deleteCategory(formData: FormData) {
  const supabase = await guard();
  const slug = String(formData.get("slug"));
  // Không xóa nếu còn khóa đang dùng loại này.
  const { count } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("category", slug);
  if ((count ?? 0) > 0) return;
  await supabase.from("course_categories").delete().eq("slug", slug);
  revalidatePath("/admin/khoa-hoc");
}

export async function toggleCoursePublish(formData: FormData) {
  const supabase = await guard();
  const id = String(formData.get("id"));
  const slug = String(formData.get("slug"));
  const published = String(formData.get("published")) === "true";
  await supabase.from("courses").update({ published: !published }).eq("id", id);
  revalidatePath(`/admin/khoa-hoc/${slug}`);
  revalidatePath("/admin/khoa-hoc");
}

export async function deleteCourse(formData: FormData) {
  const supabase = await guard();
  await supabase.from("courses").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/khoa-hoc");
  redirect("/admin/khoa-hoc");
}

// ── Chương (module) ───────────────────────────────────────────
export async function createModule(formData: FormData) {
  const supabase = await guard();
  const courseId = String(formData.get("course_id"));
  const courseSlug = String(formData.get("course_slug"));
  const { count } = await supabase
    .from("modules")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  await supabase.from("modules").insert({
    course_id: courseId,
    title: String(formData.get("title")),
    sort_order: count ?? 0,
  });
  revalidatePath(`/admin/khoa-hoc/${courseSlug}`);
}

export async function updateModule(formData: FormData) {
  const supabase = await guard();
  const courseSlug = String(formData.get("course_slug"));
  const title = String(formData.get("title")).trim();
  if (!title) return;
  // Ngày mở chương (YYYY-MM-DD); trống = mở ngay (NULL).
  const availableOn = String(formData.get("available_on") ?? "").trim() || null;
  await supabase
    .from("modules")
    .update({ title, available_on: availableOn })
    .eq("id", String(formData.get("id")));
  revalidatePath(`/admin/khoa-hoc/${courseSlug}`);
}

export async function deleteModule(formData: FormData) {
  const supabase = await guard();
  const courseSlug = String(formData.get("course_slug"));
  // Bài học trong chương tự chuyển về "Chưa xếp chương" (FK on delete set null).
  await supabase.from("modules").delete().eq("id", String(formData.get("id")));
  revalidatePath(`/admin/khoa-hoc/${courseSlug}`);
}

// ── Bài học ───────────────────────────────────────────────────
export async function createLesson(formData: FormData) {
  const supabase = await guard();
  const courseId = String(formData.get("course_id"));
  const courseSlug = String(formData.get("course_slug"));
  const title = String(formData.get("title")).trim();
  if (!title) return;
  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  const moduleId = String(formData.get("module_id") || "");
  const { data } = await supabase
    .from("lessons")
    .insert({
      course_id: courseId,
      module_id: moduleId || null,
      title,
      slug: slugify(title) || `bai-${Date.now()}`,
      sort_order: count ?? 0,
    })
    .select("slug")
    .single();
  revalidatePath(`/admin/khoa-hoc/${courseSlug}`);
  if (data) redirect(`/admin/khoa-hoc/${courseSlug}/bai/${data.slug}`);
}

export async function updateLesson(
  _prev: { ok: boolean; savedAt?: number; message?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; savedAt?: number; message?: string }> {
  await requireCoach();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const courseSlug = String(formData.get("course_slug"));
  const lessonSlug = String(formData.get("lesson_slug"));
  const { error } = await supabase
    .from("lessons")
    .update({
      title: String(formData.get("title")),
      summary: String(formData.get("summary") ?? ""),
      content: String(formData.get("content") ?? ""),
      video_url: String(formData.get("video_url") ?? "").trim(),
      pdf_url: String(formData.get("pdf_url") ?? "").trim(),
      pdf_name: String(formData.get("pdf_name") ?? "").trim(),
      est_minutes: Number(formData.get("est_minutes") || 5),
      xp_reward: Number(formData.get("xp_reward") || 20),
      module_id: String(formData.get("module_id") || "") || null,
      published: String(formData.get("published")) === "on",
      allow_download: String(formData.get("allow_download")) === "on",
      // Ngày mở bài (YYYY-MM-DD); trống = mở ngay (NULL).
      available_on: String(formData.get("available_on") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, message: "Lưu lỗi: " + error.message };
  revalidatePath(`/admin/khoa-hoc/${courseSlug}/bai/${lessonSlug}`);
  revalidatePath(`/admin/khoa-hoc/${courseSlug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function deleteLesson(formData: FormData) {
  const supabase = await guard();
  const courseSlug = String(formData.get("course_slug"));
  await supabase.from("lessons").delete().eq("id", String(formData.get("id")));
  revalidatePath(`/admin/khoa-hoc/${courseSlug}`);
  redirect(`/admin/khoa-hoc/${courseSlug}`);
}

// ── Quiz ──────────────────────────────────────────────────────
export type QuizFormState = { ok: boolean; error?: string };

export async function upsertQuiz(
  _prev: QuizFormState,
  formData: FormData,
): Promise<QuizFormState> {
  const supabase = await guard();
  const lessonId = String(formData.get("lesson_id"));
  const courseSlug = String(formData.get("course_slug"));
  const lessonSlug = String(formData.get("lesson_slug"));
  const { data: existing } = await supabase
    .from("quizzes")
    .select("id")
    .eq("lesson_id", lessonId)
    .maybeSingle();
  const payload = {
    title: String(formData.get("title") || "Kiểm tra nhanh"),
    pass_score: Number(formData.get("pass_score") || 70),
    xp_reward: Number(formData.get("xp_reward") || 30),
  };
  const { error } = existing
    ? await supabase.from("quizzes").update(payload).eq("id", existing.id)
    : await supabase.from("quizzes").insert({ lesson_id: lessonId, ...payload });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/khoa-hoc/${courseSlug}/bai/${lessonSlug}`);
  return { ok: true };
}

// Quiz CHƯƠNG (gắn vào module thay vì lesson).
export async function upsertModuleQuiz(
  _prev: QuizFormState,
  formData: FormData,
): Promise<QuizFormState> {
  const supabase = await guard();
  const moduleId = String(formData.get("module_id"));
  const path = String(formData.get("path"));
  const { data: existing } = await supabase
    .from("quizzes")
    .select("id")
    .eq("module_id", moduleId)
    .maybeSingle();
  const payload = {
    title: String(formData.get("title") || "Kiểm tra chương"),
    pass_score: Number(formData.get("pass_score") || 70),
    xp_reward: Number(formData.get("xp_reward") || 30),
  };
  const { error } = existing
    ? await supabase.from("quizzes").update(payload).eq("id", existing.id)
    : await supabase.from("quizzes").insert({ module_id: moduleId, ...payload });
  if (error) return { ok: false, error: error.message };
  revalidatePath(path);
  return { ok: true };
}

// Đường quay lại sau khi sửa câu hỏi — ưu tiên `path` (trang quiz chương),
// nếu không có thì dựng từ slug bài học.
function quizBackPath(formData: FormData) {
  const path = formData.get("path");
  if (path) return String(path);
  const courseSlug = String(formData.get("course_slug"));
  const lessonSlug = String(formData.get("lesson_slug"));
  return `/admin/khoa-hoc/${courseSlug}/bai/${lessonSlug}`;
}

export async function addQuestion(formData: FormData) {
  const supabase = await guard();
  const quizId = String(formData.get("quiz_id"));
  const options = [
    String(formData.get("opt0") ?? ""),
    String(formData.get("opt1") ?? ""),
    String(formData.get("opt2") ?? ""),
    String(formData.get("opt3") ?? ""),
  ].filter((o) => o.trim() !== "");
  if (options.length < 2) return;
  const { count } = await supabase
    .from("quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", quizId);
  await supabase.from("quiz_questions").insert({
    quiz_id: quizId,
    prompt: String(formData.get("prompt")),
    options,
    correct_index: Number(formData.get("correct_index") || 0),
    explanation: String(formData.get("explanation") ?? ""),
    sort_order: count ?? 0,
  });
  revalidatePath(quizBackPath(formData));
}

// Nhập hàng loạt câu hỏi từ file Excel (.xlsx) theo mẫu.
// Nếu file có bất kỳ dòng nào sai → không nhập gì cả, trả về danh sách lỗi để coach sửa.
export type ImportState = {
  ok: boolean;
  count?: number;
  errors?: string[];
};

export async function importQuestions(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const supabase = await guard();
  const quizId = String(formData.get("quiz_id"));
  const path = quizBackPath(formData);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, errors: ["Chưa chọn file Excel."] };
  }

  const { parseQuizWorkbook } = await import("@/lib/quiz-import");
  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors } = parseQuizWorkbook(buffer);
  if (errors.length > 0) return { ok: false, errors };

  // Thêm tiếp vào sau các câu hỏi hiện có.
  const { count } = await supabase
    .from("quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", quizId);
  const base = count ?? 0;

  const { error } = await supabase.from("quiz_questions").insert(
    rows.map((r, i) => ({
      quiz_id: quizId,
      prompt: r.prompt,
      options: r.options,
      correct_index: r.correct_index,
      explanation: r.explanation,
      sort_order: base + i,
    })),
  );
  if (error) return { ok: false, errors: ["Lưu lỗi: " + error.message] };

  revalidatePath(path);
  return { ok: true, count: rows.length };
}

export async function editQuestion(formData: FormData) {
  const supabase = await guard();
  const options = [
    String(formData.get("opt0") ?? ""),
    String(formData.get("opt1") ?? ""),
    String(formData.get("opt2") ?? ""),
    String(formData.get("opt3") ?? ""),
  ].filter((o) => o.trim() !== "");
  if (options.length < 2) return;
  // Đáp án đúng không được trỏ ra ngoài số đáp án còn lại.
  const correctIndex = Math.min(
    Number(formData.get("correct_index") || 0),
    options.length - 1,
  );
  await supabase
    .from("quiz_questions")
    .update({
      prompt: String(formData.get("prompt")),
      options,
      correct_index: correctIndex,
      explanation: String(formData.get("explanation") ?? ""),
    })
    .eq("id", String(formData.get("id")));
  revalidatePath(quizBackPath(formData));
}

export async function deleteQuestion(formData: FormData) {
  const supabase = await guard();
  await supabase
    .from("quiz_questions")
    .delete()
    .eq("id", String(formData.get("id")));
  revalidatePath(quizBackPath(formData));
}

// ── Duyệt ghi danh / phân khóa ────────────────────────────────
export async function approveEnrollment(formData: FormData) {
  const supabase = await guard();
  // Duyệt = cấp lại lượt làm quiz mới (quan trọng khi duyệt HỌC LẠI).
  await supabase
    .from("enrollments")
    .update({ status: "approved", attempts_reset_at: new Date().toISOString() })
    .eq("id", String(formData.get("id")));
  revalidatePath("/admin/yeu-cau");
  revalidatePath("/admin");
}

export async function denyEnrollment(formData: FormData) {
  const supabase = await guard();
  await supabase.from("enrollments").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/yeu-cau");
  revalidatePath("/admin");
}

// Admin phân khóa trực tiếp cho học viên (duyệt luôn).
// Trả về kết quả kèm trạng thái gửi email để hiện xác nhận cho coach.
export async function assignCourse(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await guard();
  const userId = String(formData.get("user_id"));
  const courseId = String(formData.get("course_id"));
  if (!courseId) return { ok: false, message: "Thiếu khóa học." };
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("enrollments")
      .update({ status: "approved", attempts_reset_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("enrollments")
      .insert({ user_id: userId, course_id: courseId, status: "approved" });
  }

  // Báo email cho học viên khi vừa MỞ quyền học (bỏ qua nếu đã đang học sẵn).
  // Best-effort: gửi lỗi không làm hỏng việc phân khóa.
  let emailNote = "";
  if (!existing || existing.status !== "approved") {
    try {
      const [{ data: prof }, { data: course }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("courses")
          .select("title, slug, cover_emoji")
          .eq("id", courseId)
          .maybeSingle(),
      ]);
      if (prof?.email && course) {
        const { sendCourseAssignedEmail } = await import("@/lib/mailer");
        await sendCourseAssignedEmail({
          to: prof.email,
          fullName: prof.full_name ?? "",
          courseTitle: course.title,
          courseSlug: course.slug,
          courseEmoji: course.cover_emoji ?? "📘",
        });
        emailNote = " và đã gửi email thông báo cho học viên";
      } else if (!prof?.email) {
        emailNote = " (học viên chưa có email nên chưa gửi thông báo)";
      }
    } catch (e) {
      console.error("Gửi email phân khóa thất bại:", e);
      emailNote = " nhưng gửi email thông báo thất bại";
    }
  }

  revalidatePath(`/admin/hoc-vien/${userId}`);
  return { ok: true, message: `Đã mở khóa cho học viên${emailNote}.` };
}

// Phân công NỘI DUNG cho một học viên trong một khóa: gán riêng từng chương
// (cả chương) và/hoặc từng bài học. Ghi đè toàn bộ phân công của khóa này.
//   mode "all"    → xóa hết phân công (học viên xem TẤT CẢ, mặc định).
//   mode "custom" → chỉ mở các chương/bài được chọn.
export async function setContentAssignments(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await guard();
  const userId = String(formData.get("user_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const mode = String(formData.get("mode") ?? "custom");
  if (!userId || !courseId)
    return { ok: false, message: "Thiếu học viên hoặc khóa học." };

  const parseIds = (name: string) =>
    [
      ...new Set(
        String(formData.get(name) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
  const moduleIds = mode === "all" ? [] : parseIds("module_ids");
  const lessonIds = mode === "all" ? [] : parseIds("lesson_ids");

  // Phạm vi chương/bài thuộc khóa này (để xóa đúng phần cần ghi đè + chống
  // gán nhầm id ngoài khóa).
  const [{ data: mods }, { data: less }] = await Promise.all([
    supabase.from("modules").select("id").eq("course_id", courseId),
    supabase.from("lessons").select("id").eq("course_id", courseId),
  ]);
  const courseModuleIds = new Set((mods ?? []).map((m) => m.id as string));
  const courseLessonIds = new Set((less ?? []).map((l) => l.id as string));
  const okModules = moduleIds.filter((id) => courseModuleIds.has(id));
  const okLessons = lessonIds.filter((id) => courseLessonIds.has(id));

  // Ghi đè: xóa phân công cũ của khóa này rồi chèn lại theo lựa chọn mới.
  if (courseModuleIds.size > 0)
    await supabase
      .from("module_assignments")
      .delete()
      .eq("user_id", userId)
      .in("module_id", [...courseModuleIds]);
  if (courseLessonIds.size > 0)
    await supabase
      .from("lesson_assignments")
      .delete()
      .eq("user_id", userId)
      .in("lesson_id", [...courseLessonIds]);

  if (okModules.length > 0)
    await supabase
      .from("module_assignments")
      .insert(okModules.map((id) => ({ user_id: userId, module_id: id })));
  if (okLessons.length > 0)
    await supabase
      .from("lesson_assignments")
      .insert(okLessons.map((id) => ({ user_id: userId, lesson_id: id })));

  revalidatePath(`/admin/hoc-vien/${userId}`);
  if (okModules.length + okLessons.length === 0)
    return { ok: true, message: "Đã mở toàn bộ nội dung khóa cho học viên." };
  return {
    ok: true,
    message: `Đã lưu: mở ${okModules.length} chương và ${okLessons.length} bài lẻ cho học viên.`,
  };
}

export async function unassignCourse(formData: FormData) {
  const supabase = await guard();
  const userId = String(formData.get("user_id"));
  await supabase
    .from("enrollments")
    .delete()
    .eq("user_id", userId)
    .eq("course_id", String(formData.get("course_id")));
  revalidatePath(`/admin/hoc-vien/${userId}`);
}

// Phân MỘT khóa cho NHIỀU học viên cùng lúc (mode "all" = mọi học viên,
// "selected" = danh sách id truyền qua "ids"). Bỏ qua ai đã đang học sẵn,
// duyệt luôn ai đang chờ, và gửi email thông báo cho người vừa được mở khóa.
export async function assignCourseToLearners(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await guard();
  const courseId = String(formData.get("course_id") ?? "");
  const courseSlug = String(formData.get("course_slug") ?? "");
  const mode = String(formData.get("mode") ?? "selected");
  if (!courseId) return { ok: false, message: "Thiếu khóa học." };

  // Danh sách học viên đích.
  let targetIds: string[];
  if (mode === "all") {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "learner");
    targetIds = (profs ?? []).map((p) => p.id);
  } else {
    targetIds = [
      ...new Set(
        String(formData.get("ids") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
  }
  if (targetIds.length === 0)
    return { ok: false, message: "Chưa chọn học viên nào." };

  // Enrollment hiện có của khóa này trong nhóm đích.
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, user_id, status")
    .eq("course_id", courseId)
    .in("user_id", targetIds);
  const byUser = new Map((existing ?? []).map((e) => [e.user_id, e]));

  const toInsert: string[] = []; // chưa ghi danh → thêm mới
  const toApprove: string[] = []; // enrollment id đang chờ → duyệt
  const newlyOpened: string[] = []; // user id vừa được mở khóa → gửi mail
  for (const uid of targetIds) {
    const e = byUser.get(uid);
    if (!e) {
      toInsert.push(uid);
      newlyOpened.push(uid);
    } else if (e.status !== "approved") {
      toApprove.push(e.id);
      newlyOpened.push(uid);
    }
    // đã approved → bỏ qua
  }

  if (toInsert.length > 0) {
    await supabase.from("enrollments").insert(
      toInsert.map((uid) => ({
        user_id: uid,
        course_id: courseId,
        status: "approved" as const,
      })),
    );
  }
  if (toApprove.length > 0) {
    await supabase
      .from("enrollments")
      .update({
        status: "approved",
        attempts_reset_at: new Date().toISOString(),
      })
      .in("id", toApprove);
  }

  // Gửi email thông báo (best-effort) cho học viên vừa được mở khóa.
  let sentCount = 0;
  if (newlyOpened.length > 0) {
    try {
      const [{ data: course }, { data: profs }] = await Promise.all([
        supabase
          .from("courses")
          .select("title, slug, cover_emoji")
          .eq("id", courseId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("email, full_name")
          .in("id", newlyOpened),
      ]);
      const recipients = (profs ?? [])
        .map((p) => ({ email: (p.email ?? "").trim(), name: p.full_name ?? "" }))
        .filter((p) => p.email);
      if (course && recipients.length > 0) {
        const { mailerReady, sendCourseAssignedEmail } = await import(
          "@/lib/mailer"
        );
        if (mailerReady()) {
          const BATCH = 5;
          for (let i = 0; i < recipients.length; i += BATCH) {
            const batch = recipients.slice(i, i + BATCH);
            const results = await Promise.allSettled(
              batch.map((p) =>
                sendCourseAssignedEmail({
                  to: p.email,
                  fullName: p.name,
                  courseTitle: course.title,
                  courseSlug: course.slug,
                  courseEmoji: course.cover_emoji ?? "📘",
                }),
              ),
            );
            results.forEach((r) => r.status === "fulfilled" && sentCount++);
          }
        }
      }
    } catch (e) {
      console.error("Gửi email phân khóa hàng loạt thất bại:", e);
    }
  }

  if (courseSlug) revalidatePath(`/admin/khoa-hoc/${courseSlug}`);

  const opened = toInsert.length + toApprove.length;
  const already = targetIds.length - opened;
  if (opened === 0)
    return {
      ok: true,
      message: `Tất cả ${already} học viên đã học sẵn khóa này rồi.`,
    };
  const parts = [`Đã mở khóa cho ${opened} học viên`];
  if (already > 0) parts.push(`${already} người đã có sẵn`);
  if (sentCount > 0) parts.push(`đã gửi email cho ${sentCount} người`);
  return { ok: true, message: parts.join(" · ") + "." };
}

// ── Học viên ──────────────────────────────────────────────────
// Tạo tài khoản học viên bằng service role (trigger tự tạo profile + streak).
// Tự động gửi email chào mừng (link đăng nhập + mật khẩu tạm + hướng dẫn) cho
// học viên. Vẫn trả về mật khẩu tạm để coach chép tay / gửi lại nếu cần.
export async function createLearner(
  _prev: {
    ok: boolean;
    message: string;
    password?: string;
    email?: string;
    fullName?: string;
    emailSent?: boolean;
    emailError?: string;
  } | null,
  formData: FormData,
): Promise<{
  ok: boolean;
  message: string;
  password?: string;
  email?: string;
  fullName?: string;
  emailSent?: boolean;
  emailError?: string;
}> {
  await requireCoach();
  const email = String(formData.get("email")).trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const customPw = String(formData.get("password") ?? "").trim();
  if (!email) return { ok: false, message: "Cần nhập email." };
  if (customPw && customPw.length < 6)
    return { ok: false, message: "Mật khẩu cần ít nhất 6 ký tự." };

  const password = customPw || tempPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    return { ok: false, message: `Không tạo được: ${error.message}` };
  }
  revalidatePath("/admin/hoc-vien");

  // Tự động gửi email chào mừng. Nếu gửi lỗi vẫn coi như tạo thành công —
  // coach thấy cảnh báo và có thể chép tay hoặc bấm gửi lại.
  let emailSent = false;
  let emailError: string | undefined;
  try {
    const { sendWelcomeEmail } = await import("@/lib/mailer");
    await sendWelcomeEmail({ to: email, fullName, password });
    emailSent = true;
  } catch (e) {
    emailError = e instanceof Error ? e.message : "Lỗi không xác định.";
  }

  return {
    ok: true,
    message: emailSent
      ? "Đã tạo tài khoản và gửi email hướng dẫn cho học viên."
      : "Đã tạo tài khoản (chưa gửi được email — chép tay hoặc bấm gửi lại):",
    password,
    email,
    fullName,
    emailSent,
    emailError,
  };
}

// Gửi email nội dung tự soạn hàng loạt cho học viên.
// Người nhận: tất cả học viên / học viên một khóa / danh sách chọn tay.
// Dùng {ten} trong tiêu đề hoặc nội dung để tự chèn tên từng học viên.
export async function sendBroadcastEmail(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  await requireCoach();
  const supabase = await createClient();

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const mode = String(formData.get("mode") ?? "all");
  if (!subject) return { ok: false, message: "Cần nhập tiêu đề email." };
  if (!body) return { ok: false, message: "Cần nhập nội dung email." };

  // Đọc ảnh đính kèm (nếu có). Chỉ nhận file ảnh; tổng dung lượng ≤ 10MB.
  const MAX_TOTAL = 10 * 1024 * 1024;
  const files = formData
    .getAll("attachments")
    .filter((f): f is File => f instanceof File && f.size > 0);
  let totalBytes = 0;
  const images: { filename: string; content: Buffer; contentType: string }[] = [];
  for (const f of files) {
    if (!f.type.startsWith("image/"))
      return { ok: false, message: `Tệp "${f.name}" không phải ảnh.` };
    totalBytes += f.size;
    if (totalBytes > MAX_TOTAL)
      return { ok: false, message: "Tổng dung lượng ảnh vượt quá 10MB." };
    images.push({
      filename: f.name,
      content: Buffer.from(await f.arrayBuffer()),
      contentType: f.type,
    });
  }

  // Gom danh sách người nhận theo chế độ.
  let ids: string[] | null = null; // null = tất cả học viên
  if (mode === "course") {
    const courseId = String(formData.get("course_id") ?? "");
    if (!courseId) return { ok: false, message: "Hãy chọn một khóa học." };
    const { data: enr } = await supabase
      .from("enrollments")
      .select("user_id")
      .eq("course_id", courseId)
      .eq("status", "approved");
    ids = [...new Set((enr ?? []).map((e) => e.user_id))];
    if (ids.length === 0)
      return { ok: false, message: "Khóa này chưa có học viên nào." };
  } else if (mode === "selected") {
    ids = String(formData.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0)
      return { ok: false, message: "Hãy chọn ít nhất một học viên." };
  }

  let pq = supabase
    .from("profiles")
    .select("email, full_name")
    .eq("role", "learner");
  if (ids) pq = pq.in("id", ids);
  const { data: rows } = await pq;

  // Lọc email hợp lệ, bỏ trùng.
  const seen = new Set<string>();
  const recipients = (rows ?? [])
    .map((r) => ({ email: (r.email ?? "").trim(), name: r.full_name ?? "" }))
    .filter((r) => {
      if (!r.email || seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });
  if (recipients.length === 0)
    return { ok: false, message: "Không có địa chỉ email hợp lệ để gửi." };

  const { mailerReady, sendCustomEmail } = await import("@/lib/mailer");
  if (!mailerReady())
    return {
      ok: false,
      message:
        "Chưa cấu hình gửi email. Điền GMAIL_USER và GMAIL_APP_PASSWORD trong .env.local.",
    };

  const fill = (s: string, name: string) =>
    s.replaceAll("{ten}", name || "bạn");

  // Gửi theo lô nhỏ để nhanh hơn nhưng không quá tải SMTP.
  let sent = 0;
  const failed: string[] = [];
  const BATCH = 5;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((r) =>
        sendCustomEmail({
          to: r.email,
          subject: fill(subject, r.name),
          body: fill(body, r.name),
          images,
        }),
      ),
    );
    results.forEach((res, idx) => {
      if (res.status === "fulfilled") sent++;
      else failed.push(batch[idx].email);
    });
  }

  if (failed.length === 0)
    return { ok: true, message: `Đã gửi thành công tới ${sent} học viên.` };
  return {
    ok: sent > 0,
    message: `Đã gửi ${sent}/${recipients.length}. Lỗi với: ${failed.join(", ")}`,
  };
}

// Gửi email chào mừng (link đăng nhập + email + mật khẩu + hướng dẫn) cho học viên.
// Dùng ngay sau khi tạo tài khoản / đặt lại mật khẩu — lúc còn mật khẩu tạm.
export async function sendLearnerEmail(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  await requireCoach();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password)
    return { ok: false, message: "Thiếu email hoặc mật khẩu để gửi." };

  try {
    const { sendWelcomeEmail } = await import("@/lib/mailer");
    await sendWelcomeEmail({ to: email, fullName, password });
    return { ok: true, message: `Đã gửi email hướng dẫn tới ${email}.` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lỗi không xác định.";
    return { ok: false, message: `Gửi email thất bại: ${msg}` };
  }
}

type LearnerState = {
  ok: boolean;
  message: string;
  password?: string;
} | null;

// Sửa tên + email học viên (email đổi qua auth admin).
export async function updateLearner(
  _prev: LearnerState,
  formData: FormData,
): Promise<LearnerState> {
  await requireCoach();
  const id = String(formData.get("id"));
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: false, message: "Cần nhập email." };

  const admin = createAdminClient();
  const { error: authErr } = await admin.auth.admin.updateUserById(id, {
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authErr) return { ok: false, message: `Lỗi: ${authErr.message}` };

  await admin
    .from("profiles")
    .update({ full_name: fullName, email })
    .eq("id", id);

  revalidatePath(`/admin/hoc-vien/${id}`);
  revalidatePath("/admin/hoc-vien");
  return { ok: true, message: "Đã lưu thay đổi." };
}

// Đặt lại mật khẩu (sinh mật khẩu tạm mới để gửi cho học viên).
export async function resetLearnerPassword(
  _prev: LearnerState,
  formData: FormData,
): Promise<LearnerState> {
  await requireCoach();
  const id = String(formData.get("id"));
  const password = tempPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { ok: false, message: `Lỗi: ${error.message}` };
  return { ok: true, message: "Mật khẩu mới (gửi cho học viên):", password };
}

// Xóa hẳn tài khoản học viên (kéo theo tiến độ, ghi danh, XP… qua cascade).
export async function deleteLearner(formData: FormData) {
  await requireCoach();
  const id = String(formData.get("id"));
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(id);
  revalidatePath("/admin/hoc-vien");
  redirect("/admin/hoc-vien");
}
