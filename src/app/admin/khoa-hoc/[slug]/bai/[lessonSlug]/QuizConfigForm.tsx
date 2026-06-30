"use client";

import { useActionState, useEffect, useState } from "react";
import type { QuizFormState } from "../../../../actions";
import { buttonClass } from "@/components/ui";
import type { Quiz } from "@/lib/supabase/types";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

export function QuizConfigForm({
  quiz,
  action,
  hidden,
  defaultTitle = "Kiểm tra nhanh",
}: {
  quiz: Quiz | null;
  action: (
    prev: QuizFormState,
    formData: FormData,
  ) => Promise<QuizFormState>;
  hidden: Record<string, string>;
  defaultTitle?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false });

  // Hiện "Đã lưu ✓" trong vài giây sau khi lưu thành công.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="block">
        <span className="text-sm text-ink/70">Tiêu đề quiz</span>
        <input
          name="title"
          defaultValue={quiz?.title ?? defaultTitle}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="text-sm text-ink/70">Đạt (%)</span>
        <input
          name="pass_score"
          type="number"
          defaultValue={quiz?.pass_score ?? 70}
          className={`${inputCls} w-24`}
        />
      </label>
      <label className="block">
        <span className="text-sm text-ink/70">XP</span>
        <input
          name="xp_reward"
          type="number"
          defaultValue={quiz?.xp_reward ?? 30}
          className={`${inputCls} w-20`}
        />
      </label>
      <div className="flex items-center gap-2">
        <button disabled={pending} className={buttonClass("outline")}>
          {pending ? "Đang lưu…" : quiz ? "Lưu" : "Tạo quiz"}
        </button>
        {saved && <span className="text-sm text-herb">Đã lưu ✓</span>}
        {state.error && (
          <span className="text-sm text-clay">Lỗi: {state.error}</span>
        )}
      </div>
    </form>
  );
}
