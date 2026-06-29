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
      category: (String(formData.get("category")) || "dinh_duong") as never,
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
      accent: String(formData.get("accent")) as never,
      category: String(formData.get("category")) as never,
    })
    .eq("id", id);
  revalidatePath(`/admin/khoa-hoc/${slug}`);
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

export async function addQuestion(formData: FormData) {
  const supabase = await guard();
  const quizId = String(formData.get("quiz_id"));
  const courseSlug = String(formData.get("course_slug"));
  const lessonSlug = String(formData.get("lesson_slug"));
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
  revalidatePath(`/admin/khoa-hoc/${courseSlug}/bai/${lessonSlug}`);
}

export async function editQuestion(formData: FormData) {
  const supabase = await guard();
  const courseSlug = String(formData.get("course_slug"));
  const lessonSlug = String(formData.get("lesson_slug"));
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
  revalidatePath(`/admin/khoa-hoc/${courseSlug}/bai/${lessonSlug}`);
}

export async function deleteQuestion(formData: FormData) {
  const supabase = await guard();
  const courseSlug = String(formData.get("course_slug"));
  const lessonSlug = String(formData.get("lesson_slug"));
  await supabase
    .from("quiz_questions")
    .delete()
    .eq("id", String(formData.get("id")));
  revalidatePath(`/admin/khoa-hoc/${courseSlug}/bai/${lessonSlug}`);
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
export async function assignCourse(formData: FormData) {
  const supabase = await guard();
  const userId = String(formData.get("user_id"));
  const courseId = String(formData.get("course_id"));
  if (!courseId) return;
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
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
  revalidatePath(`/admin/hoc-vien/${userId}`);
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

// ── Học viên ──────────────────────────────────────────────────
// Tạo tài khoản học viên bằng service role (trigger tự tạo profile + streak).
// Trả về mật khẩu tạm để coach gửi tay cho học viên (chưa có email/domain).
export async function createLearner(
  _prev: { ok: boolean; message: string; password?: string; email?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string; password?: string; email?: string }> {
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
  return {
    ok: true,
    message: "Đã tạo tài khoản. Gửi thông tin sau cho học viên:",
    password,
    email,
  };
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
