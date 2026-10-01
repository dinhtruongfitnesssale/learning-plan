"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Payment } from "@/lib/supabase/types";

// Mọi thay đổi số dư đều đi qua RPC (0018): số xu, giá bài, giá khóa do
// SERVER đọc từ DB — form chỉ gửi id, không gửi số.

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

const back = (path: string, msg: string): never =>
  redirect(`${path}?loi=${encodeURIComponent(msg)}`);

export async function claimCheckin(
  _prev: { ok: boolean; message: string } | null,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await authed();
  const { data, error } = await supabase.rpc("claim_daily_checkin");
  if (error) return { ok: false, message: error.message };
  const r = data as { coins: number; already: boolean };
  revalidatePath("/hoc/xu");
  revalidatePath("/hoc", "layout");
  return r.already
    ? { ok: true, message: "Hôm nay bạn đã điểm danh rồi." }
    : { ok: true, message: `+${r.coins} xu! Mai quay lại nhé.` };
}

// Mở 1 bài bằng xu → vào thẳng bài vừa mở.
export async function unlockLesson(formData: FormData) {
  const supabase = await authed();
  const lessonId = String(formData.get("lesson_id"));
  const courseSlug = String(formData.get("course_slug"));
  const lessonSlug = String(formData.get("lesson_slug"));
  const coursePath = `/hoc/khoa/${courseSlug}`;

  const { error } = await supabase.rpc("unlock_lesson", {
    p_lesson_id: lessonId,
  });
  if (error) back(coursePath, error.message);

  revalidatePath(coursePath);
  revalidatePath("/hoc", "layout");
  redirect(`${coursePath}/${lessonSlug}`);
}

// Mở cả khóa bằng xu → ghi danh 'approved' ngay, không chờ coach.
export async function unlockCourse(formData: FormData) {
  const supabase = await authed();
  const courseId = String(formData.get("course_id"));
  const coursePath = `/hoc/khoa/${String(formData.get("course_slug"))}`;

  const { error } = await supabase.rpc("unlock_course", {
    p_course_id: courseId,
  });
  if (error) back(coursePath, error.message);

  revalidatePath(coursePath);
  revalidatePath("/hoc/khoa-hoc");
  revalidatePath("/hoc", "layout");
  redirect(`${coursePath}?mo=1`);
}

// Mua gói xu → sinh mã chuyển khoản (dùng chung trang /hoc/thanh-toan).
export async function startTopup(formData: FormData) {
  const supabase = await authed();
  const { data, error } = await supabase.rpc("create_topup_intent", {
    p_pack_id: String(formData.get("pack_id")),
  });
  if (error) back("/hoc/xu", error.message);
  revalidatePath("/hoc/xu");
  redirect(`/hoc/thanh-toan/${(data as Payment).code}`);
}
