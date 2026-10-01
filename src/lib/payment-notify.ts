import "server-only";
import { createAdminClient } from "./supabase/admin";
import { sendPushToUsers, type PushPayload } from "./push";
import { formatVnd, UNMATCHED_LABEL } from "./payment";

// Thông báo về điện thoại cho MỌI giao dịch tiền vào — coach khỏi phải
// mở app canh. Gọi trong after() của webhook: lỗi ở đây không được làm
// hỏng việc ghi nhận tiền.

async function coachIds() {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("role", "coach");
  return (data ?? []).map((r) => r.id as string);
}

async function pushCoaches(payload: PushPayload) {
  const ids = await coachIds();
  await sendPushToUsers(new Map(ids.map((id) => [id, payload])));
}

type PayInfo = {
  id: string;
  user_id: string | null;
  user_email: string;
  course_title: string;
  amount: number;
  coins: number;
  learner: { full_name: string } | null;
  course: { slug: string; title: string; cover_emoji: string } | null;
};

async function loadPayment(code: string): Promise<PayInfo | null> {
  const { data } = await createAdminClient()
    .from("payments")
    .select(
      "id, user_id, user_email, course_title, amount, coins, profiles(full_name), courses(slug, title, cover_emoji)",
    )
    .eq("code", code)
    .maybeSingle();
  if (!data) return null;
  return {
    ...(data as unknown as PayInfo),
    learner: data.profiles as unknown as PayInfo["learner"],
    course: data.courses as unknown as PayInfo["course"],
  };
}

const who = (p: PayInfo) => p.learner?.full_name || p.user_email || "Học viên";

// Đã tự chốt: báo coach + báo học viên (+ email mở khóa như chốt tay).
export async function notifyAutoConfirmed(code: string) {
  const p = await loadPayment(code);
  if (!p) return;
  await pushCoaches({
    title: `✅ Đã tự mở khóa · ${formatVnd(p.amount)}`,
    body: `${who(p)} — ${p.course_title}`,
    url: "/admin/thanh-toan",
    tag: `pay-${p.id}`,
  });

  if (!p.user_id) return;
  const topup = p.coins > 0;
  await sendPushToUsers(
    new Map([
      [
        p.user_id,
        topup
          ? {
              title: `🪙 Đã cộng ${p.coins.toLocaleString("vi-VN")} xu`,
              body: "Cảm ơn bạn! Xu đã vào ví, dùng mở bài học ngay nhé.",
              url: "/hoc/xu",
              tag: `pay-${p.id}`,
            }
          : {
              title: "🎉 Khóa học đã mở!",
              body: `Đã nhận học phí ${p.course_title}. Vào học thôi!`,
              url: p.course ? `/hoc/khoa/${p.course.slug}` : "/hoc",
              tag: `pay-${p.id}`,
            },
      ],
    ]),
  );

  if (!topup && p.course && p.user_email) {
    try {
      const { sendCourseAssignedEmail } = await import("./mailer");
      await sendCourseAssignedEmail({
        to: p.user_email,
        fullName: p.learner?.full_name ?? "",
        courseTitle: p.course.title,
        courseSlug: p.course.slug,
        courseEmoji: p.course.cover_emoji ?? "📘",
      });
    } catch (e) {
      console.error("Gửi email mở khóa (tự chốt) thất bại:", e);
    }
  }
}

// Khớp mã nhưng KHÔNG tự chốt được → coach cần bấm.
export async function notifyNeedsConfirm(code: string, reason: string) {
  const p = await loadPayment(code);
  if (!p) return;
  await pushCoaches({
    title: `💳 Tiền về · chờ bạn chốt · ${formatVnd(p.amount)}`,
    body: `${who(p)} — ${p.course_title}. Lý do: ${reason}.`,
    url: "/admin/thanh-toan",
    tag: `pay-${p.id}`,
  });
}

// Tiền về mà không khớp đơn nào.
export async function notifyUnmatched(result: string, amount: number, content: string) {
  await pushCoaches({
    title: `⚠ Tiền về không khớp đơn · ${formatVnd(amount)}`,
    body: `${UNMATCHED_LABEL[result] ?? result}. Nội dung: ${content || "(trống)"}`.slice(0, 180),
    url: "/admin/thanh-toan",
    tag: "pay-unmatched",
  });
}
