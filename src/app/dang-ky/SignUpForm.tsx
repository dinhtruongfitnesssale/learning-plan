"use client";

import { useActionState, useState } from "react";
import { buttonClass } from "@/components/ui";
import { signUp } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-paper px-3.5 py-2.5 text-ink placeholder:text-ink/35 outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 transition";

export function SignUpForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(signUp, null);
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="ref" value={code} />
      <Field label="Họ tên">
        <input
          name="full_name"
          required
          autoComplete="name"
          className={inputClass}
          placeholder="Nguyễn Văn A"
        />
      </Field>
      <Field label="Email">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
          placeholder="ban@email.com"
        />
      </Field>
      <Field label="Mật khẩu (ít nhất 8 ký tự)">
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
      </Field>

      {state && !state.ok && (
        <p className="text-sm text-clay bg-clay-soft rounded-lg px-3 py-2">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={buttonClass("primary", "w-full")}
      >
        {pending ? "Đang tạo tài khoản…" : "Tạo tài khoản & vào học"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink/70 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
