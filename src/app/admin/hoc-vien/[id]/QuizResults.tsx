"use client";

import { useState } from "react";
import { Card, Badge } from "@/components/ui";

type QuizRow = { title: string; best: number; attempts: number; passed: boolean };

const PER_PAGE = 4;

// Kết quả quiz của học viên — phân trang 4 quiz/trang.
export function QuizResults({ quizzes }: { quizzes: QuizRow[] }) {
  const [page, setPage] = useState(1);

  if (quizzes.length === 0) {
    return <Card className="p-6 text-ink/60 text-sm">Chưa làm quiz nào.</Card>;
  }

  const totalPages = Math.max(1, Math.ceil(quizzes.length / PER_PAGE));
  const cur = Math.min(page, totalPages);
  const items = quizzes.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

  return (
    <div className="space-y-2.5">
      <Card className="divide-y divide-ink/10">
        {items.map((q, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{q.title}</div>
              <div className="text-xs text-ink/50 font-mono tnum">
                {q.attempts} lượt làm
              </div>
            </div>
            <Badge accent={q.passed ? "herb" : "clay"}>
              {q.passed ? "Đạt" : "Chưa đạt"}
            </Badge>
            <span className="font-mono text-lg font-semibold tnum w-14 text-right">
              {q.best}%
            </span>
          </div>
        ))}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setPage(cur - 1)}
            disabled={cur <= 1}
            className={pageBtn}
          >
            ←
          </button>
          <span className="text-xs text-ink/50 font-mono tabular-nums">
            {cur}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(cur + 1)}
            disabled={cur >= totalPages}
            className={pageBtn}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

const pageBtn =
  "min-w-9 h-9 px-3 grid place-items-center rounded-lg text-sm border border-ink/15 text-ink/70 hover:border-ink/35 hover:bg-paper-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
