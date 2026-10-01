import "server-only";
import { createAdminClient } from "./supabase/admin";
import { sendPushToUsers, type PushPayload } from "./push";
import { INACTIVE_DAYS } from "./data";

// Nhắc học bằng thông báo đẩy. Chỉ xét người ĐÃ BẬT thông báo.
//
// Hằng ngày (cron ~19h giờ VN) gửi đúng MỘT loại cho mỗi người, theo thứ tự:
//   1. streak   — hôm qua có học, hôm nay chưa, chuỗi ≥ 2 ngày → sắp đứt
//   2. inactive — nghỉ đúng 3 / 7 / 14 / 30 ngày (không nhắc mỗi ngày,
//                 nhắc dồn dập là cách nhanh nhất để bị tắt thông báo)
//   3. welcome  — tạo tài khoản 1 / 3 / 7 ngày mà chưa học bài nào
// Coach bấm "Nhắc ngay" (manual) → mọi người nghỉ từ INACTIVE_DAYS ngày.

const INACTIVE_MILESTONES = [3, 7, 14, 30];
const WELCOME_MILESTONES = [1, 3, 7];

type Kind = "streak" | "inactive" | "welcome" | "manual";

// Ngày UTC — khớp streaks.last_active_date (current_date của Postgres).
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86400_000);

function firstName(full: string) {
  const parts = full.trim().split(/\s+/);
  return parts[parts.length - 1] || "bạn";
}

function message(kind: Kind, name: string, days: number, streak: number): PushPayload {
  const hi = firstName(name);
  switch (kind) {
    case "streak":
      return {
        title: `🔥 Giữ chuỗi ${streak} ngày nhé ${hi}!`,
        body: "Hôm nay bạn chưa học. Chỉ cần 1 bài trước khi hết ngày là giữ được lửa.",
        url: "/hoc",
        tag: "nhac-hoc",
      };
    case "welcome":
      return {
        title: `${hi} ơi, bắt đầu bài đầu tiên thôi 👋`,
        body: "Bài học đầu đang chờ bạn — vào điểm danh nhận xu luôn nhé.",
        url: "/hoc/khoa-hoc",
        tag: "nhac-hoc",
      };
    default:
      return {
        title: `${hi} ơi, lâu rồi chưa gặp bạn 👋`,
        body:
          days >= 14
            ? `Đã ${days} ngày rồi đó. Quay lại học tiếp, coach vẫn đang chờ bạn 💪`
            : days >= 7
              ? "Một tuần rồi! Vào học 1 bài và nhận xu điểm danh hôm nay nhé."
              : `Đã ${days} ngày bạn chưa vào học. 10 phút hôm nay là lấy lại nhịp rồi.`,
        url: "/hoc",
        tag: "nhac-hoc",
      };
  }
}

export async function runReminders(mode: "daily" | "manual") {
  const admin = createAdminClient();
  const now = new Date();
  const today = isoDay(now);
  const yesterday = isoDay(new Date(now.getTime() - 86400_000));

  const { data: subs } = await admin.from("push_subscriptions").select("user_id");
  const ids = [...new Set((subs ?? []).map((s) => s.user_id as string))];
  if (!ids.length) return { candidates: 0, sent: 0, removed: 0, failed: 0 };

  const [{ data: profiles }, { data: streaks }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, role, created_at")
      .in("id", ids)
      .eq("role", "learner"),
    admin
      .from("streaks")
      .select("user_id, current_streak, last_active_date")
      .in("user_id", ids),
  ]);
  const streakBy = new Map(
    (streaks ?? []).map((s) => [
      s.user_id as string,
      {
        current: (s.current_streak as number) ?? 0,
        last: (s.last_active_date as string | null) ?? null,
      },
    ]),
  );

  // Chọn loại nhắc cho từng người.
  const plan = new Map<string, { kind: Kind; payload: PushPayload }>();
  for (const p of profiles ?? []) {
    const id = p.id as string;
    const name = (p.full_name as string) || "";
    const s = streakBy.get(id) ?? { current: 0, last: null };
    if (s.last === today) continue; // hôm nay học rồi

    const daysOff = s.last ? daysBetween(s.last, today) : null;
    let kind: Kind | null = null;
    if (mode === "manual") {
      if (daysOff === null || daysOff >= INACTIVE_DAYS) kind = "manual";
    } else if (s.last === yesterday && s.current >= 2) {
      kind = "streak";
    } else if (daysOff !== null && INACTIVE_MILESTONES.includes(daysOff)) {
      kind = "inactive";
    } else if (daysOff === null) {
      const age = daysBetween(isoDay(new Date(p.created_at as string)), today);
      if (WELCOME_MILESTONES.includes(age)) kind = "welcome";
    }
    if (!kind) continue;
    plan.set(id, {
      kind,
      payload: message(
        kind === "manual" ? (daysOff === null ? "welcome" : "inactive") : kind,
        name,
        daysOff ?? 0,
        s.current,
      ),
    });
  }
  if (!plan.size) return { candidates: 0, sent: 0, removed: 0, failed: 0 };

  // Ghi nhật ký TRƯỚC khi gửi: chỉ dòng mới chèn được mới gửi. Cron chạy
  // lặp hay coach bấm 2 lần trong ngày cũng không ai nhận 2 thông báo.
  const { data: fresh } = await admin
    .from("push_log")
    .upsert(
      [...plan].map(([user_id, { kind }]) => ({ user_id, kind, sent_on: today })),
      { onConflict: "user_id,kind,sent_on", ignoreDuplicates: true },
    )
    .select("user_id");
  const freshIds = new Set((fresh ?? []).map((r) => r.user_id as string));

  const messages = new Map<string, PushPayload>();
  for (const [id, { payload }] of plan) {
    if (freshIds.has(id)) messages.set(id, payload);
  }
  const res = await sendPushToUsers(messages);
  return {
    candidates: plan.size,
    sent: res.delivered.size,
    removed: res.removed,
    failed: res.failed,
  };
}
