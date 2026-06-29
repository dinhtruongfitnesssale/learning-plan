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
