"use client";

import { useActionState } from "react";
import { claimCheckin } from "./actions";
import { buttonClass } from "@/components/ui";

// Nút điểm danh: hiện ngay "+5 xu" sau khi bấm, không phải chờ tải lại.
export function CheckinButton({ reward }: { reward: number }) {
  const [state, action, pending] = useActionState(claimCheckin, null);
  if (state?.ok) {
    return <span className="text-sm font-medium text-herb">{state.message}</span>;
  }
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending}
        className={buttonClass("primary", "!py-2")}
      >
        {pending ? "Đang nhận…" : `Nhận +${reward}`}
      </button>
      {state && !state.ok && (
        <span className="text-xs text-clay">{state.message}</span>
      )}
    </form>
  );
}
