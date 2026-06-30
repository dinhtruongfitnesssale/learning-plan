"use client";

import { useActionState, useEffect, useRef } from "react";
import { importQuestions, type ImportState } from "@/app/admin/actions";
import { buttonClass } from "@/components/ui";

// Nhập câu hỏi hàng loạt từ file Excel theo mẫu.
// `hidden` mang quiz_id + path (giống các form câu hỏi khác) để action biết
// quiz nào và trang nào cần revalidate.
export function QuizImportForm({ hidden }: { hidden: Record<string, string> }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    importQuestions,
    { ok: false },
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Xóa file đã chọn sau khi nhập thành công.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <details className="rounded-lg border border-dashed border-ink/20 p-4">
      <summary className="cursor-pointer select-none font-medium">
        ⬆️ Nhập câu hỏi từ Excel
      </summary>

      <div className="mt-3 space-y-3 text-sm">
        <p className="text-ink/70">
          Tải file mẫu, điền câu hỏi vào sheet{" "}
          <span className="font-medium">“Câu hỏi”</span> (xem sheet “Hướng dẫn”),
          rồi tải lên đây. Các câu hỏi sẽ được thêm vào cuối danh sách.
        </p>

        <a href="/admin/quiz-template" className="link inline-block">
          ⬇️ Tải file mẫu (.xlsx)
        </a>

        <form ref={formRef} action={formAction} className="space-y-3">
          {Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input
            type="file"
            name="file"
            required
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink/10 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-ink/15"
          />
          <button disabled={pending} className={buttonClass("primary")}>
            {pending ? "Đang nhập…" : "Nhập câu hỏi"}
          </button>
        </form>

        {state.ok && state.count !== undefined && (
          <p className="text-herb font-medium">
            ✓ Đã nhập {state.count} câu hỏi.
          </p>
        )}

        {state.errors && state.errors.length > 0 && (
          <div className="rounded-lg border border-clay/30 bg-clay/5 p-3">
            <p className="font-medium text-clay">
              Chưa nhập được — vui lòng sửa các lỗi sau rồi tải lại:
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
