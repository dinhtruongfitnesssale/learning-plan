"use client";

import { useMemo, useState, useTransition } from "react";
import { setContentAssignments } from "../../actions";
import { Card, Badge, buttonClass } from "@/components/ui";
import type { ContentCourse } from "@/lib/data";

// Khu "Phân chương / bài học": với mỗi khóa học viên đang học, coach chọn
// riêng những chương (cả chương) và/hoặc bài lẻ mà học viên này được mở.
// Bỏ chọn hết = học viên xem TẤT CẢ (không giới hạn).
export function ContentAssignment({
  userId,
  courses,
}: {
  userId: string;
  courses: ContentCourse[];
}) {
  if (courses.length === 0) {
    return (
      <p className="text-sm text-ink/50">
        Học viên chưa được phân khóa nào. Hãy mở khóa ở mục “Phân khóa học” trước.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink/55">
        Chọn riêng chương / bài học mở cho học viên này. Nếu chọn hết (hoặc bỏ
        chọn hết), học viên sẽ xem được toàn bộ nội dung khóa.
      </p>
      {courses.map((c) => (
        <CourseRow key={c.id} userId={userId} course={c} />
      ))}
    </div>
  );
}

function CourseRow({
  userId,
  course,
}: {
  userId: string;
  course: ContentCourse;
}) {
  // Tất cả bài (theo chương + bài lẻ) để tính chọn toàn phần / một phần.
  const allLessonIds = useMemo(() => {
    const ids = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    return [...ids, ...course.ungrouped.map((l) => l.id)];
  }, [course]);

  // Trạng thái ban đầu: nếu chưa giới hạn → coi như chọn tất cả.
  const initial = useMemo(() => {
    if (!course.restricted) return new Set(allLessonIds);
    const s = new Set(course.assignedLessonIds);
    const asgMod = new Set(course.assignedModuleIds);
    for (const m of course.modules)
      if (asgMod.has(m.id)) m.lessons.forEach((l) => s.add(l.id));
    return s;
  }, [course, allLessonIds]);

  const [selected, setSelected] = useState<Set<string>>(initial);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const total = allLessonIds.length;
  const chosen = allLessonIds.filter((id) => selected.has(id)).length;
  const allSelected = total > 0 && chosen === total;

  function setMany(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
    setNotice(null);
  }
  const toggleLesson = (id: string) => setMany([id], !selected.has(id));

  function save() {
    const fd = new FormData();
    fd.set("user_id", userId);
    fd.set("course_id", course.id);
    if (allSelected || chosen === 0) {
      // Chọn hết hoặc bỏ hết → xem tất cả (không giới hạn).
      fd.set("mode", "all");
    } else {
      fd.set("mode", "custom");
      // Chương chọn ĐỦ bài → gán cả chương; còn lại gán từng bài.
      const wholeModules: string[] = [];
      const lessonIds: string[] = [];
      for (const m of course.modules) {
        const ls = m.lessons.map((l) => l.id);
        if (ls.length > 0 && ls.every((id) => selected.has(id)))
          wholeModules.push(m.id);
        else ls.forEach((id) => selected.has(id) && lessonIds.push(id));
      }
      course.ungrouped.forEach(
        (l) => selected.has(l.id) && lessonIds.push(l.id),
      );
      fd.set("module_ids", wholeModules.join(","));
      fd.set("lesson_ids", lessonIds.join(","));
    }
    startTransition(async () => {
      try {
        const res = await setContentAssignments(null, fd);
        setNotice({ ok: res.ok, text: res.message });
      } catch {
        setNotice({ ok: false, text: "Có lỗi xảy ra, thử lại nhé." });
      }
    });
  }

  const hasContent = total > 0;

  return (
    <details className="group rounded-lg border border-ink/10 bg-paper open:bg-paper-2/40">
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center gap-3 px-3.5 py-3 hover:bg-paper-2 rounded-lg">
        <span className="text-ink/40 transition-transform group-open:rotate-90 shrink-0">
          ▸
        </span>
        <span className="text-xl shrink-0">{course.cover_emoji}</span>
        <span className="flex-1 min-w-0 truncate font-medium">
          {course.title}
        </span>
        {allSelected ? (
          <Badge accent="herb">Toàn bộ</Badge>
        ) : (
          <Badge accent="amber">
            {chosen}/{total} bài
          </Badge>
        )}
      </summary>

      <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-ink/10">
        {!hasContent ? (
          <p className="text-sm text-ink/50 pt-2">
            Khóa chưa có bài học nào.
          </p>
        ) : (
          <>
            <div className="flex gap-3 text-xs text-ink/55 pt-2">
              <button
                type="button"
                className="hover:text-ink"
                onClick={() => setMany(allLessonIds, true)}
              >
                Chọn hết
              </button>
              <button
                type="button"
                className="hover:text-ink"
                onClick={() => setMany(allLessonIds, false)}
              >
                Bỏ chọn
              </button>
            </div>

            {course.modules.map((m) => {
              const ls = m.lessons.map((l) => l.id);
              const allOn = ls.length > 0 && ls.every((id) => selected.has(id));
              const someOn = ls.some((id) => selected.has(id));
              return (
                <div key={m.id} className="rounded-lg border border-ink/10">
                  <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-paper-2 rounded-t-lg">
                    <input
                      type="checkbox"
                      className="accent-amber shrink-0"
                      checked={allOn}
                      ref={(el) => {
                        if (el) el.indeterminate = !allOn && someOn;
                      }}
                      onChange={() => setMany(ls, !allOn)}
                    />
                    <span className="font-medium text-sm flex-1 min-w-0 truncate">
                      {m.title}
                    </span>
                    <span className="text-xs text-ink/45">
                      {m.lessons.length} bài
                    </span>
                  </label>
                  {m.lessons.length > 0 && (
                    <ul className="border-t border-ink/5 divide-y divide-ink/5">
                      {m.lessons.map((l) => (
                        <li key={l.id}>
                          <label className="flex items-center gap-2.5 pl-8 pr-3 py-1.5 cursor-pointer hover:bg-paper-2">
                            <input
                              type="checkbox"
                              className="accent-amber shrink-0"
                              checked={selected.has(l.id)}
                              onChange={() => toggleLesson(l.id)}
                            />
                            <span className="text-sm flex-1 min-w-0 truncate">
                              {l.title}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            {course.ungrouped.length > 0 && (
              <div className="rounded-lg border border-ink/10">
                <div className="px-3 py-2 text-xs text-ink/45 border-b border-ink/5">
                  Bài chưa xếp chương
                </div>
                <ul className="divide-y divide-ink/5">
                  {course.ungrouped.map((l) => (
                    <li key={l.id}>
                      <label className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-paper-2">
                        <input
                          type="checkbox"
                          className="accent-amber shrink-0"
                          checked={selected.has(l.id)}
                          onChange={() => toggleLesson(l.id)}
                        />
                        <span className="text-sm flex-1 min-w-0 truncate">
                          {l.title}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className={buttonClass("primary", "!px-4 !py-1.5 text-sm")}
              >
                {pending ? "Đang lưu…" : "Lưu phân công"}
              </button>
              {chosen === 0 && (
                <span className="text-xs text-ink/45">
                  Chưa chọn bài nào → học viên sẽ xem toàn bộ.
                </span>
              )}
              {notice && (
                <span
                  className={`text-xs ${notice.ok ? "text-herb" : "text-clay"}`}
                >
                  {notice.ok ? "✓ " : "⚠ "}
                  {notice.text}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
