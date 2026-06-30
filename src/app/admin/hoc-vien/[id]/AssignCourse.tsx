"use client";

import { useState } from "react";
import { assignCourse } from "../../actions";
import { buttonClass } from "@/components/ui";

type C = {
  id: string;
  title: string;
  cover_emoji: string;
  categoryLabel: string;
};

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

const PER_PAGE = 4;

// Gán khóa cho học viên — có ô tìm kiếm + phân trang (4 khóa/trang).
export function AssignCourse({
  userId,
  courses,
}: {
  userId: string;
  courses: C[];
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  if (courses.length === 0) {
    return (
      <p className="text-xs text-ink/45">Học viên đã có mặt ở tất cả khóa.</p>
    );
  }

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const cur = Math.min(page, totalPages);
  const pageItems = filtered.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

  return (
    <div className="space-y-2.5">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        placeholder="Tìm khóa để gán…"
        className={inputCls}
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-ink/50">Không có khóa nào khớp.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {pageItems.map((c) => (
              <form
                key={c.id}
                action={assignCourse}
                className="flex items-center gap-3 rounded-lg border border-ink/10 bg-paper px-3 py-2"
              >
                <input type="hidden" name="user_id" value={userId} />
                <input type="hidden" name="course_id" value={c.id} />
                <span className="text-xl shrink-0">{c.cover_emoji}</span>
                <span className="flex-1 min-w-0 truncate text-sm">
                  {c.title}
                  <span className="text-ink/45">
                    {" "}
                    · {c.categoryLabel}
                  </span>
                </span>
                <button className={buttonClass("primary", "!px-3 !py-1.5 text-xs shrink-0")}>
                  Gán &amp; duyệt
                </button>
              </form>
            ))}
          </div>

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
        </>
      )}
    </div>
  );
}

const pageBtn =
  "min-w-9 h-9 px-3 grid place-items-center rounded-lg text-sm border border-ink/15 text-ink/70 hover:border-ink/35 hover:bg-paper-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
