"use server";

import { revalidatePath } from "next/cache";
import { guard, nonNeg } from "./_shared";

// ── Thanh toán ────────────────────────────────────────────────
// Coach chốt một giao dịch → RPC mở khóa học và đóng đơn trong CÙNG
// một transaction, nên không bao giờ có cảnh "đã thu tiền mà chưa mở
// khóa". Email chỉ là best-effort sau đó, gửi hỏng không làm mất tiền.
export async function confirmPayment(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await guard();
  const paymentId = String(formData.get("id"));

  const { data, error } = await supabase.rpc("confirm_payment", {
    p_payment_id: paymentId,
  });
  if (error) return { ok: false, message: error.message };

  const result = data as {
    already: boolean;
    kind?: "course" | "topup";
    user_id: string;
    course_id: string | null;
    coins?: number;
  };
  const topup = result.kind === "topup";

  // Đã chốt trước đó rồi thì đừng gửi email lần hai. Đơn nạp xu không gửi
  // email — học viên thấy xu ngay trên trang thanh toán (tự tải lại).
  if (!result.already && !topup && result.course_id) {
    try {
      const [{ data: prof }, { data: course }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", result.user_id)
          .maybeSingle(),
        supabase
          .from("courses")
          .select("title, slug, cover_emoji")
          .eq("id", result.course_id)
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
      }
    } catch (e) {
      console.error("Gửi email xác nhận thanh toán thất bại:", e);
    }
  }

  revalidatePath("/admin/thanh-toan");
  revalidatePath("/admin");
  return {
    ok: true,
    message: result.already
      ? "Giao dịch này đã chốt rồi."
      : topup
        ? `Đã cộng ${result.coins ?? 0} xu vào ví học viên.`
        : "Đã mở khóa học.",
  };
}

// Từ chối KHÔNG xóa dòng — sổ tiền phải giữ được dấu vết để đối chiếu
// sao kê về sau. RPC chỉ đổi status sang 'rejected' kèm lý do.
export async function rejectPayment(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await guard();
  const { error } = await supabase.rpc("reject_payment", {
    p_payment_id: String(formData.get("id")),
    p_note: String(formData.get("note") ?? "").trim(),
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/thanh-toan");
  revalidatePath("/admin");
  return { ok: true, message: "Đã từ chối giao dịch." };
}

// Cài đặt tự chốt thanh toán.
export async function updatePaymentSettings(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await guard();
  const { error } = await supabase
    .from("payment_settings")
    .update({
      auto_enabled: formData.get("auto_enabled") === "on",
      auto_course_max: nonNeg(formData.get("auto_course_max")),
      auto_topup_max: nonNeg(formData.get("auto_topup_max")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/thanh-toan");
  return { ok: true, message: "Đã lưu." };
}
