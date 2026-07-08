"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
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
  // Số người vừa gửi thành công — mở popup mừng khi có kết quả mới.
  const [sentCount, setSentCount] = useState<number | null>(null);

  useEffect(() => {
    if (state?.done) setSentCount(state.count ?? 0);
  }, [state]);

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

          <Attachments />

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
            {state && !state.done && (
              <span
                className={`text-sm ${state.ok ? "text-herb font-medium" : "text-clay"}`}
              >
                {state.ok ? "✓ " : ""}
                {state.message}
              </span>
            )}
          </div>
        </Card>
      </div>

      {sentCount !== null && (
        <SentPopup count={sentCount} onClose={() => setSentCount(null)} />
      )}

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

// Ô đính kèm ảnh. Dùng input file thật (name="attachments") để gửi kèm Server
// Action; state chỉ để xem trước và xóa từng ảnh. Xóa = dựng lại DataTransfer.
const MAX_TOTAL = 10 * 1024 * 1024; // 10MB — khớp giới hạn phía server

function Attachments() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // Tạo/thu hồi URL xem trước theo danh sách ảnh hiện tại.
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  // Đồng bộ mảng `files` ngược lại vào input để Server Action nhận đúng tệp.
  function syncInput(next: File[]) {
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    if (inputRef.current) inputRef.current.files = dt.files;
    setFiles(next);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    // Gộp với ảnh đã chọn, bỏ trùng theo tên+kích thước.
    const merged = [...files];
    for (const f of picked) {
      if (!merged.some((m) => m.name === f.name && m.size === f.size))
        merged.push(f);
    }
    syncInput(merged);
  }

  function remove(i: number) {
    syncInput(files.filter((_, idx) => idx !== i));
  }

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const over = totalBytes > MAX_TOTAL;

  return (
    <div className="space-y-2">
      <span className="text-sm text-ink/70">Ảnh đính kèm (tùy chọn)</span>

      <input
        ref={inputRef}
        type="file"
        name="attachments"
        accept="image/*"
        multiple
        onChange={onPick}
        className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-medium file:text-paper hover:file:bg-ink/90 file:cursor-pointer cursor-pointer"
      />

      {files.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${f.size}-${i}`}
                className="relative group w-24"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previews[i]}
                  alt={f.name}
                  className="h-24 w-24 rounded-lg object-cover border border-ink/10"
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Xóa ${f.name}`}
                  className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-ink text-paper text-xs leading-none shadow hover:bg-clay"
                >
                  ✕
                </button>
                <span className="mt-1 block truncate text-[11px] text-ink/50">
                  {f.name}
                </span>
              </div>
            ))}
          </div>
          <span
            className={`block text-xs ${over ? "text-clay" : "text-ink/50"}`}
          >
            {files.length} ảnh · {(totalBytes / 1024 / 1024).toFixed(1)}MB
            {over && " — vượt quá 10MB, hãy bớt ảnh"}
          </span>
        </>
      )}
    </div>
  );
}

// Popup mừng khi gửi xong: trang trí theo bảng màu brand (paper + herb + amber).
// Đóng bằng nút, phím Esc, hoặc bấm ra nền ngoài.
function SentPopup({ count, onClose }: { count: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Đã gửi email thành công"
      onClick={onClose}
      className="pop-overlay fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pop-card relative w-full max-w-sm overflow-hidden rounded-[var(--radius-card)] border border-ink/10 bg-paper shadow-[var(--shadow-soft)]"
      >
        {/* Dải amber trang trí ở đỉnh */}
        <div className="h-1.5 w-full bg-amber" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-full text-ink/40 transition-colors hover:bg-paper-2 hover:text-ink"
        >
          ✕
        </button>

        <div className="flex flex-col items-center px-8 pb-8 pt-7 text-center">
          {/* Vòng tròn dấu check màu herb (success) */}
          <div className="pop-check flex h-16 w-16 items-center justify-center rounded-full bg-herb-soft">
            <span className="text-3xl leading-none text-herb">✓</span>
          </div>

          <p className="eyebrow mt-5">Đã gửi xong</p>
          <h2 className="mt-1 font-serif text-2xl text-ink">
            Gửi email đăng nhập thành công
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-ink/60">
            Email đã đến hộp thư của{" "}
            <span className="font-mono font-semibold tnum text-herb">
              {count}
            </span>{" "}
            học viên. Mỗi người nhận một email riêng — không lộ địa chỉ của
            người khác.
          </p>

          <button
            type="button"
            onClick={onClose}
            className={buttonClass("primary", "mt-6 w-full")}
          >
            Tuyệt vời!
          </button>
        </div>
      </div>
    </div>
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
