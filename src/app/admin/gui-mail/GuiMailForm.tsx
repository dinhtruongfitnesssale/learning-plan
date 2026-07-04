"use client";

import { useActionState, useMemo, useState } from "react";
import { sendBroadcastEmail } from "../actions";
import { Card, buttonClass } from "@/components/ui";

type Learner = { id: string; full_name: string; email: string };
type Course = {
  id: string;
  title: string;
  cover_emoji: string;
  learners: number;
};

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

type Mode = "all" | "course" | "selected";

export function GuiMailForm({
  learners,
  courses,
}: {
  learners: Learner[];
  courses: Course[];
}) {
  const [state, action, pending] = useActionState(sendBroadcastEmail, null);
  const [mode, setMode] = useState<Mode>("all");
  const [courseId, setCourseId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const withEmail = useMemo(
    () => learners.filter((l) => (l.email ?? "").trim()),
    [learners],
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return withEmail;
    return withEmail.filter(
      (l) =>
        (l.full_name ?? "").toLowerCase().includes(t) ||
        (l.email ?? "").toLowerCase().includes(t),
    );
  }, [withEmail, q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Số người nhận dự kiến, hiển thị trên nút gửi.
  const recipientCount =
    mode === "all"
      ? withEmail.length
      : mode === "course"
        ? (courses.find((c) => c.id === courseId)?.learners ?? 0)
        : selected.size;

  const canSend =
    !pending &&
    recipientCount > 0 &&
    (mode !== "course" || courseId !== "") &&
    (mode !== "selected" || selected.size > 0);

  return (
    <form action={action} className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
      {/* Soạn nội dung */}
      <div className="space-y-4">
        <input type="hidden" name="mode" value={mode} />
        {mode === "course" && (
          <input type="hidden" name="course_id" value={courseId} />
        )}
        {mode === "selected" && (
          <input type="hidden" name="ids" value={[...selected].join(",")} />
        )}

        <Card className="p-6 space-y-4">
          <label className="block">
            <span className="text-sm text-ink/70">Tiêu đề email</span>
            <input
              name="subject"
              required
              className={inputCls}
              placeholder="Ví dụ: Bài học mới tuần này đã lên sóng"
            />
          </label>
          <label className="block">
            <span className="text-sm text-ink/70">Nội dung</span>
            <textarea
              name="body"
              required
              rows={12}
              className={`${inputCls} resize-y leading-relaxed`}
              placeholder={
                "Chào {ten},\n\nMình vừa cập nhật bài học mới...\n\nChúc bạn học vui!"
              }
            />
            <span className="mt-1 block text-xs text-ink/50">
              Mẹo: gõ <code className="font-mono text-ink/70">{"{ten}"}</code> để
              tự chèn tên từng học viên. Cách một dòng trống để ngắt đoạn.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              disabled={!canSend}
              className={buttonClass("primary")}
              type="submit"
            >
              {pending
                ? "Đang gửi…"
                : recipientCount > 0
                  ? `✉️ Gửi cho ${recipientCount} học viên`
                  : "✉️ Gửi"}
            </button>
            {state?.ok && (
              <span className="text-herb text-sm font-medium">
                ✓ {state.message}
              </span>
            )}
            {state && !state.ok && (
              <span className="text-clay text-sm">{state.message}</span>
            )}
          </div>
        </Card>
      </div>

      {/* Chọn người nhận */}
      <Card className="p-5 space-y-4 sticky top-20">
        <h2 className="font-serif text-lg">Người nhận</h2>

        <div className="space-y-2">
          <RadioRow
            checked={mode === "all"}
            onChange={() => setMode("all")}
            label="Tất cả học viên"
            hint={`${withEmail.length} người`}
          />
          <RadioRow
            checked={mode === "course"}
            onChange={() => setMode("course")}
            label="Theo khóa học"
          />
          <RadioRow
            checked={mode === "selected"}
            onChange={() => setMode("selected")}
            label="Chọn từng người"
            hint={selected.size > 0 ? `${selected.size} đã chọn` : undefined}
          />
        </div>

        {mode === "course" && (
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className={inputCls}
          >
            <option value="">— Chọn khóa học —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.cover_emoji} {c.title} ({c.learners} học viên)
              </option>
            ))}
          </select>
        )}

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
            <div className="max-h-72 overflow-y-auto rounded-lg border border-ink/10 divide-y divide-ink/5">
              {filtered.length === 0 ? (
                <p className="p-3 text-sm text-ink/50">Không có học viên khớp.</p>
              ) : (
                filtered.map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-paper-2"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(l.id)}
                      onChange={() => toggle(l.id)}
                      className="accent-amber"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm truncate">
                        {l.full_name || "(chưa đặt tên)"}
                      </span>
                      <span className="block text-xs text-ink/50 truncate">
                        {l.email}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-ink/45 border-t border-ink/10 pt-3">
          Chỉ học viên có email mới nhận được. Mỗi người nhận một email riêng —
          không lộ địa chỉ của người khác.
        </p>
      </Card>
    </form>
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
        name="mode-choice"
        checked={checked}
        onChange={onChange}
        className="accent-amber"
      />
      <span className="text-sm flex-1">{label}</span>
      {hint && <span className="text-xs text-ink/50">{hint}</span>}
    </label>
  );
}
