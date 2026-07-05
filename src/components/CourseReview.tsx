"use client";

import { useActionState, useEffect, useState } from "react";
import { submitCourseReview } from "@/app/hoc/khoa-hoc/actions";
import { REVIEW_TOPICS, type ReviewTopicKey } from "@/lib/reviews";
import { Card, Eyebrow, buttonClass } from "@/components/ui";
import type { CourseReview as Review } from "@/lib/supabase/types";

// ── Dải sao chấm điểm (1–5) ───────────────────────────────────
function StarInput({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      <input type="hidden" name={name} value={value} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          aria-label={`${n} sao`}
          className={`text-2xl leading-none transition-transform hover:scale-110 ${
            n <= shown ? "text-amber" : "text-ink/20"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ── Hiển thị sao tĩnh (chế độ đã đánh giá) ────────────────────
function Stars({ value }: { value: number }) {
  return (
    <span className="text-base leading-none tracking-tight">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? "text-amber" : "text-ink/20"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function CourseReview({
  courseId,
  courseSlug,
  initial,
}: {
  courseId: string;
  courseSlug: string;
  initial: Review | null;
}) {
  const [state, action, pending] = useActionState(submitCourseReview, null);
  const [editing, setEditing] = useState(initial === null);

  // Điểm cho từng tiêu chí (khởi tạo từ đánh giá cũ nếu có).
  const [scores, setScores] = useState<Record<ReviewTopicKey, number>>(() => {
    const base = {} as Record<ReviewTopicKey, number>;
    for (const t of REVIEW_TOPICS) base[t.key] = initial?.[t.key] ?? 0;
    return base;
  });

  // Lưu xong → thoát chế độ sửa (trang cũng được revalidate lại).
  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  const set = (key: ReviewTopicKey, v: number) =>
    setScores((s) => ({ ...s, [key]: v }));

  // ── Chế độ đọc: đã có đánh giá & không sửa ──────────────────
  if (initial && !editing) {
    return (
      <Card className="p-6 bg-herb-soft/40">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Đánh giá của bạn</Eyebrow>
          <span className="text-xs text-ink/50">💛 Cảm ơn bạn đã góp ý</span>
        </div>
        <div className="mt-4 space-y-2.5">
          {REVIEW_TOPICS.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-3">
              <span className="text-sm">{t.label}</span>
              <Stars value={initial[t.key]} />
            </div>
          ))}
        </div>
        {initial.comment && (
          <p className="mt-4 text-sm text-ink/70 border-t border-ink/10 pt-3 whitespace-pre-wrap">
            “{initial.comment}”
          </p>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={buttonClass("outline", "mt-5")}
        >
          Sửa đánh giá
        </button>
      </Card>
    );
  }

  // ── Chế độ chấm điểm ────────────────────────────────────────
  return (
    <Card className="p-6">
      <Eyebrow>Đánh giá khóa học</Eyebrow>
      <h3 className="font-serif text-2xl mt-1">Bạn thấy khóa này thế nào?</h3>
      <p className="text-ink/60 text-sm mt-1">
        Chấm sao cho từng mục và để lại cảm nhận — góp ý của bạn giúp HLV cải
        thiện khóa học.
      </p>

      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="course_id" value={courseId} />
        <input type="hidden" name="slug" value={courseSlug} />

        <div className="space-y-3">
          {REVIEW_TOPICS.map((t) => (
            <div
              key={t.key}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-ink/10 pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="font-medium text-sm">{t.label}</div>
                <div className="text-xs text-ink/50">{t.hint}</div>
              </div>
              <StarInput
                name={t.key}
                value={scores[t.key]}
                onChange={(v) => set(t.key, v)}
              />
            </div>
          ))}
        </div>

        <div>
          <label className="text-sm font-medium">Cảm nhận / góp ý</label>
          <textarea
            name="comment"
            rows={4}
            defaultValue={initial?.comment ?? ""}
            placeholder="Điều bạn thích, điều muốn cải thiện, kết quả bạn đạt được…"
            className="mt-1.5 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
          />
        </div>

        {state && !state.ok && (
          <p className="text-clay text-sm">⚠ {state.message}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className={buttonClass("primary")}
          >
            {pending ? "Đang gửi…" : initial ? "Cập nhật đánh giá" : "Gửi đánh giá"}
          </button>
          {initial && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={buttonClass("ghost")}
            >
              Hủy
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}
