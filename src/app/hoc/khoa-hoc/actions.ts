"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Payment } from "@/lib/supabase/types";

// Tài khoản khách mời (được tặng khóa) không được tự xin học khóa khác —
// phải liên hệ admin. RLS cũng chặn, đây là lớp phòng vệ phía app.
async function isGuest(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_guest")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data?.is_guest);
}

// Học viên GỬI YÊU CẦU học (chờ admin duyệt). Khóa bật "Tự duyệt" thì
// vào học ngay — RPC tự kiểm khóa có đủ điều kiện (miễn phí, công khai).
export async function requestEnroll(formData: FormData) {
  const courseId = String(formData.get("course_id"));
  const slug = String(formData.get("slug"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (await isGuest(supabase, user.id)) return;

  const { data: course } = await supabase
    .from("courses")
    .select("auto_approve")
    .eq("id", courseId)
    .maybeSingle();
  if (course?.auto_approve) {
    const { data: status, error } = await supabase.rpc("join_free_course", {
      p_course_id: courseId,
    });
    if (!error && status === "approved") {
      revalidatePath("/hoc", "layout");
      redirect(`/hoc/khoa/${slug}`);
    }
    // Không đủ điều kiện tự duyệt (vd. coach vừa đặt giá) → gửi yêu cầu như cũ.
  }

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
  if (await isGuest(supabase, user.id)) return;

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

// Học viên bấm ĐĂNG KÝ khóa có thu phí → sinh mã chuyển khoản.
//
// Số tiền KHÔNG đi qua form: RPC tự đọc courses.price ở server. Nếu để
// client gửi amount lên thì sửa DevTools là mua khóa 2 triệu với 10 nghìn.
//
// Gọi nhiều lần trả về đúng một đơn (RPC idempotent) — học viên bấm lại
// vẫn thấy cùng mã, không chuyển khoản nhầm mã cũ.
export async function startPayment(formData: FormData) {
  const courseId = String(formData.get("course_id"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fail = (msg: string) =>
    redirect("/hoc/khoa-hoc?loi=" + encodeURIComponent(msg));

  if (await isGuest(supabase, user.id)) {
    fail("Tài khoản khách mời cần liên hệ admin để được mở khóa học.");
  }

  const { data, error } = await supabase.rpc("create_payment_intent", {
    p_course_id: courseId,
  });
  if (error) fail(error.message);

  revalidatePath("/hoc/khoa-hoc");
  redirect(`/hoc/thanh-toan/${(data as Payment).code}`);
}
