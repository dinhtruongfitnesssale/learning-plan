"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mailerReady, sendPasswordResetEmail } from "@/lib/mailer";

type State = { ok: boolean; message: string } | null;

// Quên mật khẩu: tạo link khôi phục bằng service role rồi tự gửi qua Gmail
// của app (mail mặc định của Supabase bị giới hạn vài thư/giờ).
// Email có tài khoản hay không đều trả CÙNG một câu, để không ai dò được
// email nào đã đăng ký.
export async function requestPasswordReset(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Email chưa đúng định dạng." };
  }
  if (!mailerReady()) {
    return {
      ok: false,
      message: "App chưa cấu hình gửi email — liên hệ coach để được cấp lại mật khẩu.",
    };
  }

  const sent: State = {
    ok: true,
    message:
      "Nếu email này có tài khoản, link đặt lại mật khẩu đã được gửi tới hộp thư. Xem cả mục Spam/Quảng cáo nhé.",
  };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  // Không có tài khoản → im lặng, vẫn báo như đã gửi.
  if (error || !data.properties?.hashed_token) return sent;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", data.user.id)
    .maybeSingle();

  try {
    await sendPasswordResetEmail({
      to: email,
      fullName: profile?.full_name ?? "",
      tokenHash: data.properties.hashed_token,
    });
  } catch (e) {
    console.error("Gửi mail đặt lại mật khẩu thất bại:", e);
    return { ok: false, message: "Chưa gửi được email. Thử lại sau ít phút nhé." };
  }
  return sent;
}

// Đặt mật khẩu mới từ link trong email. Token chỉ được dùng ở bước này
// (không phải lúc mở trang) — trình quét link của hộp thư mở trước cũng
// không làm hỏng link.
export async function resetPassword(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password2") ?? "");

  if (password.length < 8) {
    return { ok: false, message: "Mật khẩu cần ít nhất 8 ký tự." };
  }
  if (password !== password2) {
    return { ok: false, message: "Hai ô mật khẩu chưa khớp nhau." };
  }

  const supabase = await createClient();
  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });
  if (otpErr) {
    return {
      ok: false,
      message: "Link đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới.",
    };
  }

  // verifyOtp xong là đã đăng nhập và link đã bị dùng — lỗi ở bước này thì
  // đưa sang trang Đổi mật khẩu (cần đăng nhập) thay vì bắt xin link mới.
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // Trùng mật khẩu cũ = họ vẫn nhớ mật khẩu → cho vào học luôn.
    if (/different|same/i.test(error.message)) redirect("/hoc");
    redirect("/hoc/doi-mat-khau");
  }
  redirect("/hoc");
}
