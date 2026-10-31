"use server";

import { revalidatePath } from "next/cache";
import { guard } from "./_shared";

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

// Xóa hẳn quiz của một bài học hoặc một chương. Câu hỏi & lượt làm của học
// viên tự xóa theo (khóa ngoại on delete cascade). Bài học sẽ không còn yêu
// cầu đạt quiz nữa nên hoàn thành lại bình thường.
export async function deleteQuiz(formData: FormData) {
  const supabase = await guard();
  await supabase
    .from("quizzes")
    .delete()
    .eq("id", String(formData.get("quiz_id")));
  revalidatePath(quizBackPath(formData));
}
