"use client";

import { buttonClass } from "@/components/ui";

// Nút xóa hẳn quiz (bài học hoặc chương). Có xác nhận vì thao tác xóa luôn
// câu hỏi và toàn bộ lượt làm của học viên, không khôi phục được.
export function DeleteQuizButton({
  action,
  hidden,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            "Xóa hẳn quiz này? Toàn bộ câu hỏi và lượt làm của học viên sẽ mất, KHÔNG khôi phục được.",
          )
        )
          e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button className={buttonClass("danger")}>Xóa quiz này</button>
      <p className="text-xs text-ink/45 mt-2">
        Bài sẽ không còn bắt buộc làm quiz — hoàn thành lại như bình thường.
      </p>
    </form>
  );
}
