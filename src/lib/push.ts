import "server-only";
import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";

// Gửi thông báo đẩy (Web Push) tới mọi máy của một nhóm học viên.
//
// Env (cả .env.local và Vercel):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

export type PushPayload = {
  title: string;
  body: string;
  /** Trang mở ra khi bấm thông báo. */
  url?: string;
  tag?: string;
};

export function pushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

let ready = false;
function setup() {
  if (ready) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  ready = true;
}

type SubRow = { endpoint: string; user_id: string; p256dh: string; auth: string };

// Trả về danh sách user_id đã nhận được ít nhất 1 thông báo.
// Máy đã gỡ app / thu hồi quyền (404, 410) thì xóa đăng ký luôn — không
// thì mỗi tối cron lại gửi vào hư không.
export async function sendPushToUsers(
  messages: Map<string, PushPayload>,
): Promise<{ delivered: Set<string>; removed: number; failed: number }> {
  const delivered = new Set<string>();
  if (!pushConfigured() || messages.size === 0) {
    return { delivered, removed: 0, failed: 0 };
  }
  setup();

  const admin = createAdminClient();
  const { data } = await admin
    .from("push_subscriptions")
    .select("endpoint, user_id, p256dh, auth")
    .in("user_id", [...messages.keys()]);
  const subs = (data as SubRow[]) ?? [];

  const gone: string[] = [];
  const ok: string[] = [];
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      const msg = messages.get(s.user_id);
      if (!msg) return;
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(msg),
          { TTL: 12 * 3600 }, // máy tắt nguồn quá 12 tiếng thì thôi, đừng nhắc muộn
        );
        delivered.add(s.user_id);
        ok.push(s.endpoint);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.endpoint);
        else {
          failed++;
          console.error("Gửi push lỗi:", code, (e as Error).message);
        }
      }
    }),
  );

  if (gone.length) {
    await admin.from("push_subscriptions").delete().in("endpoint", gone);
  }
  if (ok.length) {
    await admin
      .from("push_subscriptions")
      .update({ last_ok_at: new Date().toISOString() })
      .in("endpoint", ok);
  }
  return { delivered, removed: gone.length, failed };
}
