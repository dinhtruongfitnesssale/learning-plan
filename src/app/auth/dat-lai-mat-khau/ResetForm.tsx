"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { resetPassword } from "../../quen-mat-khau/actions";

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-paper px-3.5 py-2.5 text-ink placeholder:text-ink/35 outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 transition";

export function ResetForm({ tokenHash }: { tokenHash: string }) {
  const [state, action, pending] = useActionState(resetPassword, null);
  const [show, setShow] = useState(false);
  const expired = state && !state.ok && /hết hạn|đã được dùng/.test(state.message);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <label className="block">
        <span className="block text-sm font-medium text-ink/70 mb-1.5">
          Mật khẩu mới (ít nhất 8 ký tự)
        </span>
        <div className="relative">
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            className={`${inputClass} pr-12`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute inset-y-0 right-0 px-3 grid place-items-center text-ink/45 hover:text-ink transition-colors"
          >
            {show ? "🙈" : "👁️"}
          </button>
        </div>
      </label>
      <label className="block">
        <span className="block text-sm font-medium text-ink/70 mb-1.5">
          Nhập lại mật khẩu mới
        </span>
        <input
          name="password2"
          type={show ? "text" : "password"}
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
          placeholder="Gõ lại cho khớp"
        />
      </label>

      {state && !state.ok && (
        <p className="text-sm text-clay bg-clay-soft rounded-lg px-3 py-2">
          {state.message}{" "}
          {expired && (
            <Link href="/quen-mat-khau" className="link">
              Gửi link mới
            </Link>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={buttonClass("primary", "w-full")}
      >
        {pending ? "Đang lưu…" : "Lưu mật khẩu & vào học"}
      </button>
    </form>
  );
}
