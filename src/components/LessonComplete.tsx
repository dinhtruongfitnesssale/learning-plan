"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { buttonClass } from "@/components/ui";
import type { CompleteLessonResult } from "@/lib/supabase/types";

export function LessonComplete({
  lessonId,
  courseSlug,
  nextSlug,
  initialDone,
}: {
  lessonId: string;
  courseSlug: string;
  nextSlug: string | null;
  initialDone: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(initialDone);
  const [loading, setLoading] = useState(false);
  const [reward, setReward] = useState<CompleteLessonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markComplete() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("complete_lesson", {
      p_lesson_id: lessonId,
    });
    if (error) {
      setError("Có lỗi khi lưu. Thử lại nhé.");
      setLoading(false);
      return;
    }
    const result = data as CompleteLessonResult;
    setDone(true);
    if (!result.already) setReward(result);
    setLoading(false);
    router.refresh();
  }

  const nextHref = nextSlug
    ? `/hoc/khoa/${courseSlug}/${nextSlug}`
    : `/hoc/khoa/${courseSlug}`;

  return (
    <div className="rounded-[var(--radius-card)] border border-ink/10 bg-paper-2 p-6">
      {reward ? (
        <div className="text-center">
          <div className="text-3xl mb-2">🎁</div>
          <p className="font-serif text-xl">Tuyệt vời!</p>
          <div className="mt-3 flex items-center justify-center gap-2 font-mono tnum">
            <span className="rounded-full bg-paper px-3 py-1 text-sm">
              +{reward.xp} XP
            </span>
            {reward.bonus > 0 && (
              <span className="rounded-full bg-amber text-paper px-3 py-1 text-sm animate-pulse">
                +{reward.bonus} thưởng bất ngờ ✨
              </span>
            )}
          </div>
          {reward.streak ? (
            <p className="text-sm text-ink/60 mt-3">
              🔥 Chuỗi {reward.streak} ngày — giữ lửa nhé!
            </p>
          ) : null}
          <div className="mt-5">
            <Link href={nextHref} className={buttonClass("primary")}>
              {nextSlug ? "Bài tiếp theo →" : "Về trang khóa học"}
            </Link>
          </div>
        </div>
      ) : done ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-herb font-medium">✓ Bạn đã hoàn thành bài này</p>
          <Link href={nextHref} className={buttonClass("outline")}>
            {nextSlug ? "Bài tiếp theo →" : "Về trang khóa học"}
          </Link>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-ink/70 mb-4">
            Đọc xong rồi? Đánh dấu hoàn thành để nhận XP và khép vòng tròn tiến độ.
          </p>
          <button
            onClick={markComplete}
            disabled={loading}
            className={buttonClass("primary")}
          >
            {loading ? "Đang lưu…" : "Đánh dấu hoàn thành"}
          </button>
          {error && <p className="text-clay text-sm mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
