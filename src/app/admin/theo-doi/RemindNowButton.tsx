"use client";

import { useActionState } from "react";
import { remindInactiveNow } from "../actions";
import { buttonClass } from "@/components/ui";

export function RemindNowButton() {
  const [state, action, pending] = useActionState(remindInactiveNow, null);
  return (
    <form action={action} className="sm:shrink-0 sm:text-right space-y-1">
      <button disabled={pending} className={buttonClass("outline", "w-full sm:w-auto")}>
        {pending ? "Đang gửi…" : "Nhắc ngay người đang nghỉ"}
      </button>
      {state && (
        <p className={`text-xs ${state.ok ? "text-herb" : "text-clay"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
