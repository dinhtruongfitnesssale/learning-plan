"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui";

export type SaveResult = { ok: boolean; message: string } | null;

// Form có nút Lưu BÁO KẾT QUẢ: đang lưu… → ✓ Đã lưu lúc 14:32 / ⚠ lỗi.
// Server action phải có dạng (prev, formData) => { ok, message }.
export function SaveForm({
  action,
  children,
  className,
  submitLabel = "Lưu",
}: {
  action: (prev: SaveResult, formData: FormData) => Promise<SaveResult>;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: SaveResult, fd: FormData) => {
      const r = await action(prev, fd);
      if (!r?.ok) return r;
      const at = new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return { ok: true, message: `${r.message} lúc ${at}` };
    },
    null,
  );

  return (
    <form action={formAction} className={className}>
      {children}
      <button
        type="submit"
        disabled={pending}
        className={buttonClass(state?.ok ? "outline" : "primary", "w-full")}
      >
        {pending ? "Đang lưu…" : submitLabel}
      </button>
      {state && !pending && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            state.ok ? "bg-herb-soft text-herb" : "bg-clay-soft text-clay"
          }`}
        >
          {state.ok ? "✓ " : "⚠ "}
          {state.message}
        </p>
      )}
    </form>
  );
}
