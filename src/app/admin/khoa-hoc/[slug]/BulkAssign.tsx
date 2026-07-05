"use client";

import { useActionState, useMemo, useState } from "react";
import { assignCourseToLearners } from "../../actions";
import { Card, Badge, buttonClass } from "@/components/ui";

type Learner = {
  id: string;
  full_name: string;
  email: string;
  status: "none" | "pending" | "approved";
};

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

type Mode = "all" | "selected";

// Phân khóa hiện tại cho nhiều học viên: chọn Tất cả hoặc tick từng người.
export function BulkAssign({
  courseId,
  courseSlug,
  learners,
}: {
  courseId: string;
  courseSlug: string;
  learners: Learner[];
}) {
  const [state, action, pending] = useActionState(
    assignCourseToLearners,
    null,
  );
  const [mode, setMode] = useState<Mode>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return learners;
    return learners.filter(
      (l) =>
        (l.full_name ?? "").toLowerCase().includes(t) ||
        (l.email ?? "").toLowerCase().includes(t),
    );
  }, [learners, q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const recipientCount = mode === "all" ? learners.length : selected.size;
  const canSend =
    !pending &&
    recipientCount > 0 &&
    (mode !== "selected" || selected.size > 0);

  return (
    <Card className="p-5" as="section">
      <h3 className="font-serif text-lg mb-1">Phân khóa cho học viên</h3>
      <p className="text-xs text-ink/50 mb-4">
        Mở khóa này cho nhiều học viên cùng lúc. Ai đang học sẵn sẽ được bỏ qua.
      </p>

      {learners.length === 0 ? (
        <p className="text-sm text-ink/50">Chưa có học viên nào.</p>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="course_id" value={courseId} />
          <input type="hidden" name="course_slug" value={courseSlug} />
          <input type="hidden" name="mode" value={mode} />
          {mode === "selected" && (
            <input type="hidden" name="ids" value={[...selected].join(",")} />
          )}

          <div className="space-y-1.5">
            <RadioRow
              checked={mode === "all"}
              onChange={() => setMode("all")}
              label="Tất cả học viên"
              hint={`${learners.length} người`}
            />
            <RadioRow
              checked={mode === "selected"}
              onChange={() => setMode("selected")}
              label="Chọn từng người"
              hint={selected.size > 0 ? `${selected.size} đã chọn` : undefined}
            />
          </div>

          {mode === "selected" && (
            <div className="space-y-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm tên hoặc email…"
                className={inputCls}
              />
              <div className="flex items-center justify-between text-xs text-ink/55">
                <span>{filtered.length} học viên</span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="hover:text-ink"
                    onClick={() =>
                      setSelected(
                        (prev) =>
                          new Set([...prev, ...filtered.map((l) => l.id)]),
                      )
                    }
                  >
                    Chọn hết
                  </button>
                  <button
                    type="button"
                    className="hover:text-ink"
                    onClick={() => setSelected(new Set())}
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-ink/10 divide-y divide-ink/5">
                {filtered.length === 0 ? (
                  <p className="p-3 text-sm text-ink/50">
                    Không có học viên khớp.
                  </p>
                ) : (
                  filtered.map((l) => (
                    <label
                      key={l.id}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-paper-2"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(l.id)}
                        onChange={() => toggle(l.id)}
                        className="accent-amber shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm truncate">
                          {l.full_name || "(chưa đặt tên)"}
                        </span>
                        <span className="block text-xs text-ink/50 truncate">
                          {l.email || "chưa có email"}
                        </span>
                      </span>
                      {l.status === "approved" && (
                        <Badge accent="herb">Đang học</Badge>
                      )}
                      {l.status === "pending" && (
                        <Badge accent="slate">Chờ duyệt</Badge>
                      )}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              disabled={!canSend}
              className={buttonClass("primary")}
              type="submit"
            >
              {pending
                ? "Đang phân…"
                : recipientCount > 0
                  ? `Phân cho ${recipientCount} học viên`
                  : "Phân khóa"}
            </button>
          </div>

          {state && (
            <p
              className={`text-sm ${state.ok ? "text-herb" : "text-clay"}`}
            >
              {state.ok ? "✓ " : "⚠ "}
              {state.message}
            </p>
          )}
        </form>
      )}
    </Card>
  );
}

function RadioRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="radio"
        name="bulk-mode-choice"
        checked={checked}
        onChange={onChange}
        className="accent-amber"
      />
      <span className="text-sm flex-1">{label}</span>
      {hint && <span className="text-xs text-ink/50">{hint}</span>}
    </label>
  );
}
