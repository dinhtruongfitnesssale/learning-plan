"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buttonClass, Badge, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { QuizPublic, SubmitQuizResult } from "@/lib/supabase/types";

export function Quiz({
  lessonId,
  bestPercent,
}: {
  lessonId: string;
  bestPercent: number | null;
}) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizPublic | null>(null);
  const [started, setStarted] = useState(false);
  const [cur, setCur] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SubmitQuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc("get_quiz", { p_lesson_id: lessonId })
      .then(({ data }) => setQuiz(data as QuizPublic | null));
  }, [lessonId]);

  if (!quiz) return null;

  const total = quiz.questions.length;
  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined);
  // Câu chưa trả lời đầu tiên — chỉ cho phép đi tới câu này, không nhảy cóc.
  const firstUnanswered = (() => {
    const i = quiz.questions.findIndex((q) => answers[q.id] === undefined);
    return i === -1 ? total : i;
  })();

  async function submit() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_quiz", {
      p_lesson_id: lessonId,
      p_answers: answers,
    });
    if (error) {
      setError("Không nộp được bài. Thử lại nhé.");
      setSubmitting(false);
      return;
    }
    setResult(data as SubmitQuizResult);
    setSubmitting(false);
    router.refresh();
  }

  function start() {
    setResult(null);
    setAnswers({});
    setCur(0);
    setStarted(true);
    setError(null);
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-slate/30 bg-slate-soft/40 p-6">
      <div className="flex items-center justify-between mb-1">
        <Eyebrow>Kiểm tra năng lực</Eyebrow>
        {bestPercent !== null && (
          <Badge accent="slate">Kỷ lục: {bestPercent}%</Badge>
        )}
      </div>
      <h3 className="font-serif text-2xl mb-1">{quiz.title}</h3>
      <p className="text-sm text-ink/60 mb-5">
        Cần đúng từ {quiz.pass_score}% để đạt. XP cộng theo đúng số câu bạn làm
        được — đo năng lực thật.
      </p>

      {/* (1) Màn hình giới thiệu — chưa hiện câu hỏi */}
      {!started && !result && (
        <div>
          {total === 0 ? (
            <p className="text-sm text-ink/60">Quiz chưa có câu hỏi nào.</p>
          ) : (
            <>
              <p className="text-sm text-ink/70 mb-4">
                Bài kiểm tra có <span className="font-medium">{total} câu</span>.
                Làm lần lượt từng câu, có thể xem lại câu trước. Trả lời hết mới
                nộp được bài.
              </p>
              <button onClick={start} className={buttonClass("primary")}>
                Làm quiz →
              </button>
            </>
          )}
        </div>
      )}

      {/* (2) Đang làm — mỗi lần một câu */}
      {started && total > 0 && !result && (
        <QuizRunner
          quiz={quiz}
          cur={cur}
          setCur={setCur}
          answers={answers}
          setAnswers={setAnswers}
          firstUnanswered={firstUnanswered}
          allAnswered={allAnswered}
          submitting={submitting}
          onSubmit={submit}
          error={error}
        />
      )}

      {/* (3) Kết quả + xem lại toàn bộ */}
      {result && (
        <>
          <ResultBanner result={result} onRetry={start} />
          <Review quiz={quiz} answers={answers} result={result} />
        </>
      )}
    </section>
  );
}

function QuizRunner({
  quiz,
  cur,
  setCur,
  answers,
  setAnswers,
  firstUnanswered,
  allAnswered,
  submitting,
  onSubmit,
  error,
}: {
  quiz: QuizPublic;
  cur: number;
  setCur: (n: number) => void;
  answers: Record<string, number>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  firstUnanswered: number;
  allAnswered: boolean;
  submitting: boolean;
  onSubmit: () => void;
  error: string | null;
}) {
  const total = quiz.questions.length;
  const q = quiz.questions[cur];
  const isLast = cur === total - 1;
  const curAnswered = answers[q.id] !== undefined;

  return (
    <div>
      {/* Tiến độ + nhảy nhanh giữa các câu (chỉ tới câu đã mở) */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="font-mono text-sm text-ink/60 tnum">
          Câu {cur + 1} / {total}
        </span>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {quiz.questions.map((qq, i) => {
            const answered = answers[qq.id] !== undefined;
            const reachable = i <= firstUnanswered;
            return (
              <button
                key={qq.id}
                type="button"
                disabled={!reachable}
                onClick={() => setCur(i)}
                title={`Câu ${i + 1}`}
                className={cn(
                  "w-7 h-7 rounded-full text-xs font-mono tnum transition-colors",
                  i === cur && "ring-2 ring-amber ring-offset-1",
                  answered
                    ? "bg-amber-soft text-ink"
                    : "bg-paper text-ink/40 border border-ink/15",
                  !reachable && "opacity-40 cursor-not-allowed",
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Câu hỏi hiện tại */}
      <p className="font-medium mb-3">
        <span className="font-mono text-ink/40 mr-2 tnum">{cur + 1}.</span>
        {q.prompt}
      </p>
      <div className="space-y-2">
        {q.options.map((opt, oi) => {
          const picked = answers[q.id] === oi;
          return (
            <button
              key={oi}
              type="button"
              onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
              className={cn(
                "w-full text-left rounded-lg border px-4 py-2.5 text-sm transition-colors",
                picked
                  ? "border-amber bg-amber-soft"
                  : "border-ink/15 bg-paper hover:border-ink/30",
              )}
            >
              <span className="font-mono text-ink/40 mr-2">
                {String.fromCharCode(65 + oi)}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      {error && <p className="text-clay text-sm mt-4">{error}</p>}

      {/* Điều hướng */}
      <div className="flex items-center justify-between gap-3 mt-6">
        <button
          type="button"
          onClick={() => setCur(cur - 1)}
          disabled={cur === 0}
          className={cn(
            buttonClass("outline"),
            cur === 0 && "opacity-40 cursor-not-allowed",
          )}
        >
          ← Câu trước
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!allAnswered || submitting}
            className={cn(
              buttonClass("primary"),
              (!allAnswered || submitting) && "opacity-40 cursor-not-allowed",
            )}
          >
            {submitting ? "Đang chấm…" : "Nộp bài"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCur(cur + 1)}
            disabled={!curAnswered}
            className={cn(
              buttonClass("primary"),
              !curAnswered && "opacity-40 cursor-not-allowed",
            )}
          >
            Câu sau →
          </button>
        )}
      </div>

      {isLast && !allAnswered && (
        <p className="text-xs text-ink/45 mt-2 text-right">
          Còn câu chưa trả lời — quay lại hoàn thành để nộp bài.
        </p>
      )}
    </div>
  );
}

// Xem lại toàn bộ câu hỏi + đáp án sau khi nộp.
function Review({
  quiz,
  answers,
  result,
}: {
  quiz: QuizPublic;
  answers: Record<string, number>;
  result: SubmitQuizResult;
}) {
  const resultMap = new Map(result.results.map((r) => [r.id, r]));
  return (
    <ol className="space-y-6 mt-6">
      {quiz.questions.map((q, qi) => {
        const r = resultMap.get(q.id);
        return (
          <li key={q.id}>
            <p className="font-medium mb-3">
              <span className="font-mono text-ink/40 mr-2 tnum">{qi + 1}.</span>
              {q.prompt}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const picked = answers[q.id] === oi;
                const isCorrect = r && oi === r.correct_index;
                const isWrongPick = r && picked && !r.correct;
                return (
                  <div
                    key={oi}
                    className={cn(
                      "w-full text-left rounded-lg border px-4 py-2.5 text-sm",
                      "border-ink/15 bg-paper",
                      isCorrect && "border-herb bg-herb-soft",
                      isWrongPick && "border-clay bg-clay-soft",
                    )}
                  >
                    <span className="font-mono text-ink/40 mr-2">
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                    {isCorrect && <span className="text-herb float-right">✓</span>}
                    {isWrongPick && (
                      <span className="text-clay float-right">✕</span>
                    )}
                  </div>
                );
              })}
            </div>
            {r && r.explanation && (
              <p className="text-sm text-slate mt-2 pl-1">💡 {r.explanation}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ResultBanner({
  result,
  onRetry,
}: {
  result: SubmitQuizResult;
  onRetry: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3",
        result.passed ? "bg-herb-soft" : "bg-clay-soft",
      )}
    >
      <div>
        <p className="font-serif text-xl">
          {result.passed
            ? "Đạt rồi! 🌿"
            : result.locked
              ? "Khóa học đã bị khóa 🔒"
              : "Gần đạt — thử lại nhé"}
        </p>
        <p className="font-mono text-sm tnum mt-0.5">
          {result.correct}/{result.total} đúng · {result.percent}%
          {result.xp > 0 && <span className="text-herb"> · +{result.xp} XP</span>}
          {result.bonus > 0 && (
            <span className="text-amber"> · +{result.bonus} thưởng ✨</span>
          )}
        </p>
        {!result.passed &&
          (result.locked ? (
            <p className="text-sm text-clay mt-1">
              Bạn đã làm sai 2 lần. Hãy vào trang khóa học để “Yêu cầu học lại”.
            </p>
          ) : (
            <p className="text-sm text-clay mt-1">
              Còn {result.fails_left} lượt làm — sai nữa sẽ bị khóa khóa học.
            </p>
          ))}
      </div>
      {!result.locked && (
        <button onClick={onRetry} className={buttonClass("outline")}>
          Làm lại
        </button>
      )}
    </div>
  );
}
