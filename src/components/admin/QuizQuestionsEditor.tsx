import { buttonClass } from "@/components/ui";
import { addQuestion, editQuestion, deleteQuestion } from "@/app/admin/actions";
import type { QuizQuestion } from "@/lib/supabase/types";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

// Danh sách + thêm/sửa/xóa câu hỏi cho 1 quiz (dùng cho quiz bài học và quiz chương).
// `path` là đường dẫn trang để revalidate sau mỗi thao tác.
export function QuizQuestionsEditor({
  quizId,
  questions,
  path,
}: {
  quizId: string;
  questions: QuizQuestion[];
  path: string;
}) {
  return (
    <>
      {questions.length > 0 && (
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <li
              key={q.id}
              className="rounded-lg border border-ink/10 bg-paper-2 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">
                  <span className="font-mono text-ink/40 mr-1">{i + 1}.</span>
                  {q.prompt}
                </p>
                <form action={deleteQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="path" value={path} />
                  <button className="text-xs text-clay hover:underline shrink-0">
                    xóa
                  </button>
                </form>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {q.options.map((opt, oi) => (
                  <li
                    key={oi}
                    className={
                      oi === q.correct_index
                        ? "text-herb font-medium"
                        : "text-ink/60"
                    }
                  >
                    {String.fromCharCode(65 + oi)}. {opt}
                    {oi === q.correct_index && " ✓"}
                  </li>
                ))}
              </ul>

              {/* Sửa câu hỏi */}
              <details className="mt-3">
                <summary className="cursor-pointer select-none text-xs link">
                  ✎ Sửa câu hỏi
                </summary>
                <form
                  action={editQuestion}
                  className="mt-3 space-y-3 rounded-lg border border-ink/10 bg-paper p-4"
                >
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="path" value={path} />
                  <input
                    name="prompt"
                    required
                    defaultValue={q.prompt}
                    placeholder="Câu hỏi…"
                    className={inputCls}
                  />
                  <div className="grid sm:grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map((oi) => (
                      <input
                        key={oi}
                        name={`opt${oi}`}
                        defaultValue={q.options[oi] ?? ""}
                        placeholder={`Đáp án ${String.fromCharCode(65 + oi)}${
                          oi < 2 ? " (bắt buộc)" : ""
                        }`}
                        className={inputCls}
                      />
                    ))}
                  </div>
                  <div className="grid sm:grid-cols-[auto_1fr] gap-3 items-end">
                    <label className="block">
                      <span className="text-sm text-ink/70">Đáp án đúng</span>
                      <select
                        name="correct_index"
                        className={inputCls}
                        defaultValue={String(q.correct_index)}
                      >
                        <option value="0">A</option>
                        <option value="1">B</option>
                        <option value="2">C</option>
                        <option value="3">D</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm text-ink/70">
                        Giải thích (hiện sau khi nộp)
                      </span>
                      <input
                        name="explanation"
                        defaultValue={q.explanation ?? ""}
                        className={inputCls}
                      />
                    </label>
                  </div>
                  <button className={buttonClass("outline")}>
                    Lưu thay đổi
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ol>
      )}

      {/* Thêm câu hỏi */}
      <form
        action={addQuestion}
        className="space-y-3 rounded-lg border border-dashed border-ink/20 p-4"
      >
        <input type="hidden" name="quiz_id" value={quizId} />
        <input type="hidden" name="path" value={path} />
        <p className="eyebrow">Thêm câu hỏi</p>
        <input
          name="prompt"
          required
          placeholder="Câu hỏi…"
          className={inputCls}
        />
        <div className="grid sm:grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              name={`opt${i}`}
              placeholder={`Đáp án ${String.fromCharCode(65 + i)}${
                i < 2 ? " (bắt buộc)" : ""
              }`}
              className={inputCls}
            />
          ))}
        </div>
        <div className="grid sm:grid-cols-[auto_1fr] gap-3 items-end">
          <label className="block">
            <span className="text-sm text-ink/70">Đáp án đúng</span>
            <select name="correct_index" className={inputCls} defaultValue="0">
              <option value="0">A</option>
              <option value="1">B</option>
              <option value="2">C</option>
              <option value="3">D</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-ink/70">
              Giải thích (hiện sau khi nộp)
            </span>
            <input name="explanation" className={inputCls} />
          </label>
        </div>
        <button className={buttonClass("primary")}>+ Thêm câu hỏi</button>
      </form>
    </>
  );
}
