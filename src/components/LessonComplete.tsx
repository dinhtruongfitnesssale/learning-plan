"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { buttonClass } from "@/components/ui";
import type { CompleteLessonResult } from "@/lib/supabase/types";

export function LessonComplete({
  lessonId,
  courseSlug,
  nextSlug,
  nextLocked = false,
  initialDone,
  hasQuiz = false,
  quizPassed = false,
}: {
  lessonId: string;
  courseSlug: string;
  nextSlug: string | null;
  nextLocked?: boolean;
  initialDone: boolean;
  hasQuiz?: boolean;
  quizPassed?: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(initialDone);
  const [loading, setLoading] = useState(false);
  const [reward, setReward] = useState<CompleteLessonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Đạt quiz của bài rồi thì tự đánh dấu hoàn thành luôn — khỏi phải bấm thêm
  // nút (nhiều học viên đạt quiz nhưng quên bấm, khiến bài kế bị khóa mãi).
  const autoRan = useRef(false);
  useEffect(() => {
    if (!done && hasQuiz && quizPassed && !autoRan.current) {
      autoRan.current = true;
      markComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, hasQuiz, quizPassed]);

  async function markComplete() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("complete_lesson", {
      p_lesson_id: lessonId,
    });
    if (error) {
      setError(error.message || "Có lỗi khi lưu. Thử lại nhé.");
      setLoading(false);
      return;
    }
    const result = data as CompleteLessonResult;
    setDone(true);
    if (!result.already) setReward(result);
    setLoading(false);
    router.refresh();
  }

  // Chỉ mở bài kế khi có bài kế VÀ nó không bị khóa; ngược lại về trang khóa.
  const canGoNext = !!nextSlug && !nextLocked;
  const nextHref = canGoNext
    ? `/hoc/khoa/${courseSlug}/${nextSlug}`
    : `/hoc/khoa/${courseSlug}`;
  const nextLabel = canGoNext ? "Bài tiếp theo →" : "Về trang khóa học";

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
              {nextLabel}
            </Link>
          </div>
        </div>
      ) : done ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-herb font-medium">✓ Bạn đã hoàn thành bài này</p>
          <Link href={nextHref} className={buttonClass("outline")}>
            {nextLabel}
          </Link>
        </div>
      ) : hasQuiz && !quizPassed ? (
        <div className="text-center">
          <p className="text-ink/70">
            Hãy làm và <span className="font-medium">đạt bài quiz</span> phía trên
            trước, rồi mới đánh dấu hoàn thành được nhé.
          </p>
          <button
            disabled
            className={`${buttonClass("primary")} mt-4 opacity-40 cursor-not-allowed`}
          >
            Cần đạt quiz trước 🔒
          </button>
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
