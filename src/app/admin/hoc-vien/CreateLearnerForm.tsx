"use client";

import { useActionState } from "react";
import { createLearner } from "../actions";
import { buttonClass } from "@/components/ui";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

export function CreateLearnerForm() {
  const [state, formAction, pending] = useActionState(createLearner, null);

  return (
    <div>
      <form action={formAction} className="space-y-3">
        <label className="block">
          <span className="text-sm text-ink/70">Họ tên học viên</span>
          <input name="full_name" className={inputCls} placeholder="Nguyễn Thị A" />
        </label>
        <label className="block">
          <span className="text-sm text-ink/70">Email</span>
          <input
            name="email"
            type="email"
            required
            className={inputCls}
            placeholder="hocvien@email.com"
          />
        </label>
        <button disabled={pending} className={buttonClass("primary", "w-full")}>
          {pending ? "Đang tạo…" : "Tạo tài khoản"}
        </button>
      </form>

      {state && !state.ok && (
        <p className="text-sm text-clay bg-clay-soft rounded-lg px-3 py-2 mt-3">
          {state.message}
        </p>
      )}

      {state && state.ok && (
        <div className="mt-3 rounded-lg border border-herb/40 bg-herb-soft/50 p-3 text-sm">
          <p className="text-ink/80 mb-2">{state.message}</p>
          <div className="font-mono text-ink space-y-1">
            <div>
              📧 <span className="select-all">{state.email}</span>
            </div>
            <div>
              🔑 <span className="select-all font-semibold">{state.password}</span>
            </div>
          </div>
          <p className="text-xs text-ink/55 mt-2">
            Chép gửi cho học viên. Họ đăng nhập rồi đổi mật khẩu sau (khi bạn có
            tên miền + email tự động).
          </p>
        </div>
      )}
    </div>
  );
}
