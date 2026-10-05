"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui";
import { requestPasswordReset } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-paper px-3.5 py-2.5 text-ink placeholder:text-ink/35 outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 transition";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium text-ink/70 mb-1.5">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
          placeholder="ban@email.com"
        />
      </label>

      {state && (
        <p
          role="status"
          className={`text-sm rounded-lg px-3 py-2 ${
            state.ok ? "text-herb bg-herb-soft" : "text-clay bg-clay-soft"
          }`}
        >
          {state.ok ? "✓ " : ""}
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={buttonClass("primary", "w-full")}
      >
        {pending ? "Đang gửi…" : state?.ok ? "Gửi lại link" : "Gửi link đặt lại"}
      </button>
    </form>
  );
}
