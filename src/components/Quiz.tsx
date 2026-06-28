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

  const resultMap = new Map(result?.results.map((r) => [r.id, r]) ?? []);
  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined);

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

  function retry() {
    setResult(null);
    setAnswers({});
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

      <ol className="space-y-6">
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
                    <button
                      key={oi}
                      type="button"
                      disabled={!!result}
                      onClick={() =>
                        setAnswers((a) => ({ ...a, [q.id]: oi }))
                      }
                      className={cn(
                        "w-full text-left rounded-lg border px-4 py-2.5 text-sm transition-colors",
                        !result && picked
                          ? "border-amber bg-amber-soft"
                          : "border-ink/15 bg-paper hover:border-ink/30",
                        isCorrect && "border-herb bg-herb-soft",
                        isWrongPick && "border-clay bg-clay-soft",
                      )}
                    >
                      <span className="font-mono text-ink/40 mr-2">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      {opt}
                      {isCorrect && <span className="text-herb float-right">✓</span>}
                      {isWrongPick && <span className="text-clay float-right">✕</span>}
                    </button>
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

      {error && <p className="text-clay text-sm mt-4">{error}</p>}

      {!result ? (
        <div className="mt-6">
          <button
            onClick={submit}
            disabled={!allAnswered || submitting}
            className={buttonClass("primary")}
          >
            {submitting ? "Đang chấm…" : "Nộp bài"}
          </button>
          {!allAnswered && (
            <p className="text-xs text-ink/45 mt-2">
              Trả lời hết các câu để nộp.
            </p>
          )}
        </div>
      ) : (
        <ResultBanner result={result} onRetry={retry} />
      )}
    </section>
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
        "mt-6 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3",
        result.passed ? "bg-herb-soft" : "bg-clay-soft",
      )}
    >
      <div>
        <p className="font-serif text-xl">
          {result.passed ? "Đạt rồi! 🌿" : "Gần đạt — thử lại nhé"}
        </p>
        <p className="font-mono text-sm tnum mt-0.5">
          {result.correct}/{result.total} đúng · {result.percent}%
          {result.xp > 0 && (
            <span className="text-herb"> · +{result.xp} XP</span>
          )}
          {result.bonus > 0 && (
            <span className="text-amber"> · +{result.bonus} thưởng ✨</span>
          )}
        </p>
      </div>
      <button onClick={onRetry} className={buttonClass("outline")}>
        Làm lại
      </button>
    </div>
  );
}
