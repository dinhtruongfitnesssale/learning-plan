"use client";

import { useState, useTransition } from "react";
import { assignCourse, unassignCourse } from "../../actions";
import { Badge, buttonClass } from "@/components/ui";

type UnassignedCourse = {
  id: string;
  title: string;
  cover_emoji: string;
  categoryLabel: string;
};
type EnrolledCourse = {
  id: string;
  title: string;
  cover_emoji: string;
  status: "pending" | "approved";
};

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";
const pageBtn =
  "min-w-9 h-9 px-3 grid place-items-center rounded-lg text-sm border border-ink/15 text-ink/70 hover:border-ink/35 hover:bg-paper-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
const PER_PAGE = 4;

// Toàn bộ khu "Phân khóa học": gán khóa mới + danh sách đang ghi danh.
// Giữ 1 thông báo xác nhận ổn định (không mất khi danh sách đổi sau thao tác).
export function CourseAssignment({
  userId,
  unassigned,
  enrolled,
}: {
  userId: string;
  unassigned: UnassignedCourse[];
  enrolled: EnrolledCourse[];
}) {
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  function run(
    courseId: string,
    fn: (fd: FormData) => Promise<{ ok: boolean; message: string } | void>,
    fallback: string,
  ) {
    setBusyId(courseId);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("user_id", userId);
      fd.set("course_id", courseId);
      try {
        const res = await fn(fd);
        setNotice(
          res && "message" in res
            ? { ok: res.ok, text: res.message }
            : { ok: true, text: fallback },
        );
      } catch {
        setNotice({ ok: false, text: "Có lỗi xảy ra, thử lại nhé." });
      } finally {
        setBusyId(null);
      }
    });
  }

  const filtered = unassigned.filter((c) =>
    c.title.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const cur = Math.min(page, totalPages);
  const pageItems = filtered.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

  return (
    <>
      {notice && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            notice.ok ? "bg-herb-soft text-herb" : "bg-clay-soft text-clay"
          }`}
        >
          {notice.ok ? "✓ " : "⚠ "}
          {notice.text}
        </div>
      )}

      {/* Gán khóa mới */}
      {unassigned.length === 0 ? (
        <p className="text-xs text-ink/45">Học viên đã có mặt ở tất cả khóa.</p>
      ) : (
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
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border border-ink/10 bg-paper px-3 py-2"
                  >
                    <span className="text-xl shrink-0">{c.cover_emoji}</span>
                    <span className="flex-1 min-w-0 truncate text-sm">
                      {c.title}
                      <span className="text-ink/45"> · {c.categoryLabel}</span>
                    </span>
                    <button
                      onClick={() => run(c.id, assignCourse, "Đã mở khóa.")}
                      disabled={busyId === c.id}
                      className={buttonClass(
                        "primary",
                        "!px-3 !py-1.5 text-xs shrink-0",
                      )}
                    >
                      {busyId === c.id ? "Đang gán…" : "Gán & duyệt"}
                    </button>
                  </div>
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
      )}

      {/* Khóa đang ghi danh */}
      {enrolled.length > 0 && (
        <div className="divide-y divide-ink/10 border-t border-ink/10 pt-1">
          {enrolled.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2.5">
              <span className="text-xl shrink-0">{c.cover_emoji}</span>
              <span className="flex-1 min-w-0 truncate">{c.title}</span>
              <Badge accent={c.status === "approved" ? "herb" : "slate"}>
                {c.status === "approved" ? "Đang học" : "Chờ duyệt"}
              </Badge>
              {c.status === "pending" && (
                <button
                  onClick={() => run(c.id, assignCourse, "Đã duyệt.")}
                  disabled={busyId === c.id}
                  className={buttonClass("ghost", "!px-3 !py-1.5 text-xs")}
                >
                  {busyId === c.id ? "Đang duyệt…" : "Duyệt"}
                </button>
              )}
              <button
                onClick={() =>
                  run(c.id, unassignCourse, "Đã gỡ khóa khỏi học viên.")
                }
                disabled={busyId === c.id}
                className="text-xs text-clay hover:underline shrink-0 disabled:opacity-40"
              >
                Gỡ
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
