"use client";

import { useState } from "react";
import { assignCourse } from "../../actions";
import { buttonClass } from "@/components/ui";
import { CATEGORIES } from "@/lib/brand";

type C = {
  id: string;
  title: string;
  cover_emoji: string;
  category: "dinh_duong" | "tap_luyen";
};

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

// Gán khóa cho học viên — có ô tìm kiếm khóa.
export function AssignCourse({
  userId,
  courses,
}: {
  userId: string;
  courses: C[];
}) {
  const [q, setQ] = useState("");

  if (courses.length === 0) {
    return (
      <p className="text-xs text-ink/45">Học viên đã có mặt ở tất cả khóa.</p>
    );
  }

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="space-y-2.5">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm khóa để gán…"
        className={inputCls}
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-ink/50">Không có khóa nào khớp.</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-auto">
          {filtered.map((c) => (
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
                  · {CATEGORIES[c.category]?.label}
                </span>
              </span>
              <button className={buttonClass("primary", "!px-3 !py-1.5 text-xs shrink-0")}>
                Gán &amp; duyệt
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
