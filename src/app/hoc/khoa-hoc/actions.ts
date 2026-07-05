"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Học viên GỬI YÊU CẦU học (chờ admin duyệt). Không vào học ngay.
export async function requestEnroll(formData: FormData) {
  const courseId = String(formData.get("course_id"));
  const slug = String(formData.get("slug"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!existing) {
    await supabase
      .from("enrollments")
      .insert({ user_id: user.id, course_id: courseId, status: "pending" });
  }

  revalidatePath("/hoc/khoa-hoc");
  if (slug) revalidatePath(`/hoc/khoa/${slug}`);
}

// Học viên bị KHÓA (fail quiz quá 2 lần) xin học lại → quay về 'pending'
// để admin duyệt lại (duyệt sẽ cấp lại 2 lượt làm mới).
export async function requestRelearn(formData: FormData) {
  const courseId = String(formData.get("course_id"));
  const slug = String(formData.get("slug"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("request_relearn", { p_course_id: courseId });

  revalidatePath("/hoc/khoa-hoc");
  if (slug) revalidatePath(`/hoc/khoa/${slug}`);
}

// Học viên GỬI ĐÁNH GIÁ khóa học (sau khi học xong). Chấm 5 tiêu chí
// theo thang 1–5 sao + góp ý. Gửi lại sẽ CẬP NHẬT đánh giá cũ.
export async function submitCourseReview(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const courseId = String(formData.get("course_id"));
  const slug = String(formData.get("slug"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Ép về thang 1–5; thiếu tiêu chí nào coi như chưa chấm.
  const clamp = (name: string) => {
    const n = Math.round(Number(formData.get(name)));
    return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0;
  };
  const ratings = {
    r_content: clamp("r_content"),
    r_coach: clamp("r_coach"),
    r_difficulty: clamp("r_difficulty"),
    r_applicability: clamp("r_applicability"),
    r_overall: clamp("r_overall"),
  };
  if (Object.values(ratings).some((v) => v < 1)) {
    return { ok: false, message: "Hãy chấm sao cho tất cả các mục nhé." };
  }

  const { error } = await supabase.from("course_reviews").upsert(
    {
      user_id: user.id,
      course_id: courseId,
      ...ratings,
      comment: String(formData.get("comment") ?? "").trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,course_id" },
  );
  if (error) {
    return { ok: false, message: "Lưu đánh giá lỗi: " + error.message };
  }

  if (slug) revalidatePath(`/hoc/khoa/${slug}`);
  revalidatePath("/admin/danh-gia");
  return { ok: true, message: "Cảm ơn bạn đã đánh giá! 💛" };
}
