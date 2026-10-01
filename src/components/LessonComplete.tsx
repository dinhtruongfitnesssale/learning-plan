"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { buttonClass } from "@/components/ui";
import { unlockLesson } from "@/app/hoc/xu/actions";
import type { CompleteLessonResult } from "@/lib/supabase/types";

export function LessonComplete({
  lessonId,
  courseSlug,
  nextSlug,
  nextLocked = false,
  initialDone,
  hasQuiz = false,
  quizPassed = false,
  nextPaywalled = false,
  nextUnlock = null,
}: {
  lessonId: string;
  courseSlug: string;
  nextSlug: string | null;
  nextLocked?: boolean;
  initialDone: boolean;
  hasQuiz?: boolean;
  quizPassed?: boolean;
  /** Bài kế chưa mua (ngoài phần học thử). */
  nextPaywalled?: boolean;
  /** Khóa bán lẻ từng bài → mở bài kế bằng xu ngay tại đây. */
  nextUnlock?: { lessonId: string; price: number; balance: number } | null;
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
  const nextLabel = canGoNext
    ? "Bài tiếp theo →"
    : nextPaywalled
      ? "Mở khóa để học tiếp →"
      : "Về trang khóa học";

  // Nút đi tiếp sau khi học xong. Bài kế chưa mua mà khóa bán lẻ từng bài
  // → mở bằng xu ngay tại chỗ: đây là lúc người học muốn xem tiếp nhất.
  const nextAction = (variant: "primary" | "outline") => {
    if (nextPaywalled && nextUnlock && nextSlug) {
      if (nextUnlock.balance >= nextUnlock.price) {
        return (
          <form action={unlockLesson}>
            <input type="hidden" name="lesson_id" value={nextUnlock.lessonId} />
            <input type="hidden" name="course_slug" value={courseSlug} />
            <input type="hidden" name="lesson_slug" value={nextSlug} />
            <button
              type="submit"
              className={buttonClass(variant, "w-full sm:w-auto shrink-0")}
            >
              🪙 Mở bài tiếp theo · {nextUnlock.price} xu
            </button>
            <p className="text-xs text-ink/50 mt-1.5">
              Bạn đang có {nextUnlock.balance} xu
            </p>
          </form>
        );
      }
      return (
        <div className="space-y-1.5">
          <Link
            href="/hoc/xu"
            className={buttonClass(variant, "w-full sm:w-auto shrink-0")}
          >
            🪙 Kiếm thêm xu để học tiếp
          </Link>
          <p className="text-xs text-ink/50">
            Bài tiếp cần {nextUnlock.price} xu · bạn có {nextUnlock.balance} xu
          </p>
        </div>
      );
    }
    return (
      <Link
        href={nextHref}
        className={buttonClass(variant, "w-full sm:w-auto shrink-0")}
      >
        {nextLabel}
      </Link>
    );
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-ink/10 bg-paper-2 p-5 sm:p-6">
      {reward ? (
        <div className="text-center">
          <div className="text-3xl mb-2">🎁</div>
          <p className="font-serif text-xl">Tuyệt vời!</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 font-mono tnum">
            <span className="rounded-full bg-paper px-3 py-1 text-sm">
              +{reward.xp} XP
            </span>
            {reward.bonus > 0 && (
              <span className="rounded-full bg-amber text-paper px-3 py-1 text-sm animate-pulse">
                +{reward.bonus} thưởng bất ngờ ✨
              </span>
            )}
          </div>
          {(reward.coins ?? 0) > 0 || (reward.streak_coins ?? 0) > 0 ? (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 font-mono tnum">
              {(reward.coins ?? 0) > 0 && (
                <span className="rounded-full bg-amber-soft px-3 py-1 text-sm">
                  🪙 +{reward.coins} xu
                </span>
              )}
              {(reward.streak_coins ?? 0) > 0 && (
                <span className="rounded-full bg-amber text-paper px-3 py-1 text-sm">
                  🔥 +{reward.streak_coins} xu mốc chuỗi
                </span>
              )}
            </div>
          ) : null}
          {reward.cap_reached && (
            <p className="text-xs text-ink/50 mt-2">
              Hôm nay đã nhận đủ xu học tập — mai học tiếp sẽ có xu.
            </p>
          )}
          {reward.streak ? (
            <p className="text-sm text-ink/60 mt-3">
              🔥 Chuỗi {reward.streak} ngày — giữ lửa nhé!
            </p>
          ) : null}
          <div className="mt-5 flex justify-center">{nextAction("primary")}</div>
        </div>
      ) : done ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-herb font-medium">✓ Bạn đã hoàn thành bài này</p>
          {nextAction("outline")}
        </div>
      ) : hasQuiz && !quizPassed ? (
        <div className="text-center">
          <p className="text-ink/70">
            Hãy làm và <span className="font-medium">đạt bài quiz</span> phía trên
            trước, rồi mới đánh dấu hoàn thành được nhé.
          </p>
          <button
            disabled
            className={`${buttonClass("primary", "w-full sm:w-auto")} mt-4 opacity-40 cursor-not-allowed`}
          >
            Cần đạt quiz trước 🔒
          </button>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-ink/70 mb-4">
            Đọc xong rồi? Đánh dấu hoàn thành để nhận XP, xu và khép vòng tròn
            tiến độ.
          </p>
          <button
            onClick={markComplete}
            disabled={loading}
            className={buttonClass("primary", "w-full sm:w-auto")}
          >
            {loading ? "Đang lưu…" : "Đánh dấu hoàn thành"}
          </button>
          {error && <p className="text-clay text-sm mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
