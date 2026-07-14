"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui";

// Nút xóa hẳn quiz (bài học hoặc chương). Xác nhận bằng hộp thoại theo thương
// hiệu (thay confirm() mặc định của trình duyệt) vì thao tác xóa luôn câu hỏi
// và toàn bộ lượt làm của học viên, không khôi phục được.
export function DeleteQuizButton({
  action,
  hidden,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <form action={action}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("danger")}
      >
        Xóa quiz này
      </button>
      <p className="text-xs text-ink/45 mt-2">
        Bài sẽ không còn bắt buộc làm quiz — hoàn thành lại như bình thường.
      </p>

      {open && <ConfirmDialog onClose={() => setOpen(false)} />}
    </form>
  );
}

function ConfirmDialog({ onClose }: { onClose: () => void }) {
  // Đóng bằng phím Esc + khóa cuộn nền khi mở (giống các modal khác trong app).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="bg-paper rounded-[var(--radius-card)] w-full max-w-md shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className="grid place-items-center w-11 h-11 rounded-full bg-clay-soft text-clay text-xl shrink-0"
            >
              🗑️
            </span>
            <div className="min-w-0">
              <h4 className="font-serif text-xl">Xóa hẳn quiz này?</h4>
              <p className="text-sm text-ink/60 mt-1.5">
                Toàn bộ câu hỏi và lượt làm của học viên sẽ mất và{" "}
                <span className="font-medium text-ink/80">
                  không khôi phục được
                </span>
                . Bài sẽ không còn bắt buộc làm quiz nữa.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-paper-2 border-t border-ink/10">
          <button
            type="button"
            onClick={onClose}
            className={buttonClass("outline")}
          >
            Để sau
          </button>
          <ConfirmSubmit />
        </div>
      </div>
    </div>
  );
}

// Nút xóa thật — submit form cha (server action). useFormStatus để hiện trạng
// thái đang xóa và chặn bấm nhiều lần.
function ConfirmSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("danger")}>
      {pending ? "Đang xóa…" : "Xóa hẳn quiz"}
    </button>
  );
}
