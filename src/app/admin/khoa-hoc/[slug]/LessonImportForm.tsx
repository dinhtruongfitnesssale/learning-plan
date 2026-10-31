"use client";

import { useActionState, useEffect, useRef } from "react";
import { importLessons, type LessonImportState } from "../../actions/courses";
import { buttonClass } from "@/components/ui";

// Cập nhật chương + bài học hàng loạt từ file Excel: tải file (điền sẵn bài
// hiện có) → sửa / thêm dòng → tải lên lại.
export function LessonImportForm({ courseId, courseSlug }: { courseId: string; courseSlug: string }) {
  const [state, formAction, pending] = useActionState<LessonImportState, FormData>(
    importLessons,
    { ok: false },
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Xóa file đã chọn sau khi nhập thành công.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <details className="rounded-[var(--radius-card)] border border-dashed border-ink/20 bg-paper p-5">
      <summary className="cursor-pointer select-none font-serif text-lg">
        📊 Cập nhật bài học từ Excel
      </summary>

      <div className="mt-3 space-y-3 text-sm">
        <ol className="list-decimal pl-5 space-y-1 text-ink/70">
          <li>
            Tải file về. File đã điền sẵn chương và bài đang có. Xem cách điền ở sheet
            “Hướng dẫn”.
          </li>
          <li>
            Sửa hoặc thêm dòng ở sheet <span className="font-medium">“Bài học”</span>: chương,
            tên bài, mô tả, link video, link tài liệu, nội dung… Thứ tự dòng là thứ tự bài.
          </li>
          <li>Tải file lên lại. Bài không có trong file sẽ được giữ nguyên, không bị xóa.</li>
        </ol>

        <a href={`/admin/khoa-hoc/${courseSlug}/excel`} className="link inline-block">
          ⬇️ Tải file Excel bài học
        </a>

        <form ref={formRef} action={formAction} className="space-y-3">
          <input type="hidden" name="course_id" value={courseId} />
          <input type="hidden" name="course_slug" value={courseSlug} />
          <input
            type="file"
            name="file"
            required
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink/10 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-ink/15"
          />
          <button disabled={pending} className={buttonClass("primary", "w-full sm:w-auto")}>
            {pending ? "Đang cập nhật…" : "Tải lên & cập nhật"}
          </button>
        </form>

        {state.ok && (
          <p className="text-herb font-medium">
            ✓ Đã thêm {state.created} bài mới, cập nhật {state.updated} bài
            {state.newChapters ? `, tạo ${state.newChapters} chương mới` : ""}.
          </p>
        )}

        {state.errors && state.errors.length > 0 && (
          <div className="rounded-lg border border-clay/30 bg-clay/5 p-3">
            <p className="font-medium text-clay">
              Chưa cập nhật được — sửa các lỗi sau rồi tải lại:
            </p>
            <ul className="mt-1 list-disc pl-5 text-clay/90 space-y-0.5">
              {state.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
