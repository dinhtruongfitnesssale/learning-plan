"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type State = { ok: boolean; message: string } | null;

// Tự đăng ký tài khoản (khi coach bật ở Admin → Xu). Có MÃ GIỚI THIỆU hợp
// lệ thì gắn người mời + tặng quà chào mừng; không có / sai mã thì vẫn tạo
// tài khoản thường.
export async function signUp(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("ref") ?? "").trim().toUpperCase();

  if (!fullName) return { ok: false, message: "Nhập họ tên của bạn." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Email chưa đúng định dạng." };
  }
  if (password.length < 8) {
    return { ok: false, message: "Mật khẩu cần ít nhất 8 ký tự." };
  }

  const admin = createAdminClient();
  const [{ data: cfg }, { data: inviter }] = await Promise.all([
    admin.from("coin_settings").select("signup_enabled").eq("id", 1).maybeSingle(),
    code
      ? admin.from("profiles").select("id").eq("referral_code", code).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!cfg?.signup_enabled) {
    return { ok: false, message: "Đăng ký tài khoản đang tạm đóng." };
  }

  // email_confirm: true — không bắt xác nhận email, để bạn mới vào học
  // ngay. Đổi lại người mời chỉ được thưởng khi bạn mới học xong bài đầu,
  // nên tạo nick ảo hàng loạt không đẻ ra xu.
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !created.user) {
    const dup = /already|registered|exists/i.test(error?.message ?? "");
    return {
      ok: false,
      message: dup
        ? "Email này đã có tài khoản — hãy đăng nhập."
        : "Không tạo được tài khoản. Thử lại sau nhé.",
    };
  }

  // Gắn người mời + tặng quà chào mừng. Hỏng bước này không chặn đăng ký.
  if (inviter) {
    const { error: refErr } = await admin.rpc("apply_referral", {
      p_user: created.user.id,
      p_code: code,
    });
    if (refErr) console.error("apply_referral thất bại:", refErr);
  }

  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) redirect("/login");
  // Có quà chào mừng → mở ví xu cho thấy; đăng ký thường → vào trang học.
  redirect(inviter ? "/hoc/xu" : "/hoc");
}
