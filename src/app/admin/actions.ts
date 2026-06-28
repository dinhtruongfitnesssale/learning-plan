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
    })
    .select("id")
    .single();
  revalidatePath("/admin/khoa-hoc");
  if (data) redirect(`/admin/khoa-hoc/${data.id}`);
}

export async function updateCourse(formData: FormData) {
  const supabase = await guard();
  const id = String(formData.get("id"));
  await supabase
    .from("courses")
    .update({
      title: String(formData.get("title")),
      summary: String(formData.get("summary") ?? ""),
      cover_emoji: String(formData.get("cover_emoji") || "🍲"),
      accent: String(formData.get("accent")) as never,
    })
    .eq("id", id);
  revalidatePath(`/admin/khoa-hoc/${id}`);
}

export async function toggleCoursePublish(formData: FormData) {
  const supabase = await guard();
  const id = String(formData.get("id"));
  const published = String(formData.get("published")) === "true";
  await supabase.from("courses").update({ published: !published }).eq("id", id);
  revalidatePath(`/admin/khoa-hoc/${id}`);
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
  const { count } = await supabase
    .from("modules")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  await supabase.from("modules").insert({
    course_id: courseId,
    title: String(formData.get("title")),
    sort_order: count ?? 0,
  });
  revalidatePath(`/admin/khoa-hoc/${courseId}`);
}

// ── Bài học ───────────────────────────────────────────────────
export async function createLesson(formData: FormData) {
  const supabase = await guard();
  const courseId = String(formData.get("course_id"));
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
    .select("id")
    .single();
  revalidatePath(`/admin/khoa-hoc/${courseId}`);
  if (data) redirect(`/admin/khoa-hoc/${courseId}/bai/${data.id}`);
}

export async function updateLesson(formData: FormData) {
  const supabase = await guard();
  const id = String(formData.get("id"));
  const courseId = String(formData.get("course_id"));
  await supabase
    .from("lessons")
    .update({
      title: String(formData.get("title")),
      summary: String(formData.get("summary") ?? ""),
      content: String(formData.get("content") ?? ""),
      est_minutes: Number(formData.get("est_minutes") || 5),
      xp_reward: Number(formData.get("xp_reward") || 20),
      module_id: String(formData.get("module_id") || "") || null,
      published: String(formData.get("published")) === "on",
    })
    .eq("id", id);
  revalidatePath(`/admin/khoa-hoc/${courseId}/bai/${id}`);
  revalidatePath(`/admin/khoa-hoc/${courseId}`);
}

export async function deleteLesson(formData: FormData) {
  const supabase = await guard();
  const courseId = String(formData.get("course_id"));
  await supabase.from("lessons").delete().eq("id", String(formData.get("id")));
  revalidatePath(`/admin/khoa-hoc/${courseId}`);
  redirect(`/admin/khoa-hoc/${courseId}`);
}

// ── Quiz ──────────────────────────────────────────────────────
export async function upsertQuiz(formData: FormData) {
  const supabase = await guard();
  const lessonId = String(formData.get("lesson_id"));
  const courseId = String(formData.get("course_id"));
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
  if (existing) {
    await supabase.from("quizzes").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("quizzes").insert({ lesson_id: lessonId, ...payload });
  }
  revalidatePath(`/admin/khoa-hoc/${courseId}/bai/${lessonId}`);
}

export async function addQuestion(formData: FormData) {
  const supabase = await guard();
  const quizId = String(formData.get("quiz_id"));
  const lessonId = String(formData.get("lesson_id"));
  const courseId = String(formData.get("course_id"));
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
  revalidatePath(`/admin/khoa-hoc/${courseId}/bai/${lessonId}`);
}

export async function deleteQuestion(formData: FormData) {
  const supabase = await guard();
  const lessonId = String(formData.get("lesson_id"));
  const courseId = String(formData.get("course_id"));
  await supabase
    .from("quiz_questions")
    .delete()
    .eq("id", String(formData.get("id")));
  revalidatePath(`/admin/khoa-hoc/${courseId}/bai/${lessonId}`);
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
  if (!email) return { ok: false, message: "Cần nhập email." };

  const password = tempPassword();
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
