"use client";

import { useActionState } from "react";
import { sendLearnerEmail } from "../actions";
import { buttonClass } from "@/components/ui";

// Nút gửi email hướng dẫn (link đăng nhập + email + mật khẩu + cách học) cho học viên.
// Cần mật khẩu ở dạng chữ nên chỉ hiện ngay sau khi tạo tài khoản / đặt lại mật khẩu.
export function SendEmailButton({
  email,
  password,
  fullName = "",
}: {
  email: string;
  password: string;
  fullName?: string;
}) {
  const [state, action, pending] = useActionState(sendLearnerEmail, null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={action}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="password" value={password} />
        <input type="hidden" name="full_name" value={fullName} />
        <button disabled={pending} className={buttonClass("outline")}>
          {pending ? "Đang gửi…" : "✉️ Gửi email cho học viên"}
        </button>
      </form>
      {state?.ok && <span className="text-herb text-sm font-medium">✓ {state.message}</span>}
      {state && !state.ok && <span className="text-clay text-sm">{state.message}</span>}
    </div>
  );
}
