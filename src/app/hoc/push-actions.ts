"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push";

type SubJSON = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Lưu "địa chỉ nhận thông báo" của máy này cho người đang đăng nhập.
// Ghi bằng service role vì cùng một máy có thể đổi tài khoản: endpoint
// đó phải chuyển sang người mới, mà RLS không cho sửa dòng của người khác.
export async function savePushSubscription(sub: SubJSON, userAgent: string) {
  const user = await me();
  if (!user) return { ok: false };
  const endpoint = sub.endpoint ?? "";
  const p256dh = sub.keys?.p256dh ?? "";
  const auth = sub.keys?.auth ?? "";
  // Chỉ nhận endpoint https thật — chặn ai đó nhét URL tùy ý để server
  // đi gọi hộ.
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return { ok: false };

  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      {
        endpoint,
        user_id: user.id,
        p256dh,
        auth,
        user_agent: userAgent.slice(0, 300),
      },
      { onConflict: "endpoint" },
    );
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string) {
  const user = await me();
  if (!user) return { ok: false };
  await createAdminClient()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  return { ok: true };
}

export async function sendTestPush() {
  const user = await me();
  if (!user) return { ok: false };
  const res = await sendPushToUsers(
    new Map([
      [
        user.id,
        {
          title: "🔔 Đã bật nhắc học",
          body: "Bếp Học sẽ nhắc bạn khi sắp đứt chuỗi hoặc lâu rồi chưa vào học.",
          url: "/hoc",
          tag: "thu",
        },
      ],
    ]),
  );
  return { ok: res.delivered.size > 0 };
}
