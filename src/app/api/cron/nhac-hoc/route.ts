import { createHash, timingSafeEqual } from "node:crypto";
import { runReminders } from "@/lib/reminders";

// GET /api/cron/nhac-hoc — Vercel Cron gọi mỗi ngày (xem vercel.json),
// gửi thông báo nhắc học lên điện thoại học viên.
//
// Vercel tự gắn "Authorization: Bearer <CRON_SECRET>" khi gọi cron nếu
// project có env CRON_SECRET. Route mở công khai trong proxy (cron không
// có cookie đăng nhập) nên BẮT BUỘC tự kiểm khóa ở đây.

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // thiếu env → từ chối hết
  const given = (request.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const result = await runReminders("daily");
  return Response.json({ ok: true, ...result });
}
