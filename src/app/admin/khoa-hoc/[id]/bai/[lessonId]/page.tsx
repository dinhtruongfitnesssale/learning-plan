import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import {
  updateLesson,
  deleteLesson,
  upsertQuiz,
  addQuestion,
  deleteQuestion,
} from "../../../../actions";
import type { Lesson, Module, Quiz, QuizQuestion } from "@/lib/supabase/types";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

export default async function LessonEditor({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id: courseId, lessonId } = await params;
  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) notFound();
  const l = lesson as Lesson;

  const [{ data: modules }, { data: quizRow }] = await Promise.all([
    supabase.from("modules").select("*").eq("course_id", courseId).order("sort_order"),
    supabase.from("quizzes").select("*").eq("lesson_id", lessonId).maybeSingle(),
  ]);
  const mods = (modules as Module[]) ?? [];
  const quiz = quizRow as Quiz | null;

  let questions: QuizQuestion[] = [];
  if (quiz) {
    const { data: qs } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", quiz.id)
      .order("sort_order");
    questions = (qs as QuizQuestion[]) ?? [];
  }

  return (
    <div className="space-y-7">
      <Link href={`/admin/khoa-hoc/${courseId}`} className="link text-sm">
        ← Về khóa học
      </Link>

      <section>
        <Eyebrow>Sửa bài học</Eyebrow>
        <h1 className="font-serif text-3xl mt-1">{l.title}</h1>
      </section>

      {/* Nội dung bài */}
      <Card className="p-6">
        <form action={updateLesson} className="space-y-4">
          <input type="hidden" name="id" value={l.id} />
          <input type="hidden" name="course_id" value={courseId} />
          <label className="block">
            <span className="text-sm text-ink/70">Tiêu đề</span>
            <input name="title" defaultValue={l.title} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm text-ink/70">Tóm tắt (1 dòng)</span>
            <input name="summary" defaultValue={l.summary} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm text-ink/70">
              Nội dung (Markdown — ## tiêu đề, - gạch đầu dòng, **đậm**, &gt; trích dẫn)
            </span>
            <textarea
              name="content"
              defaultValue={l.content}
              rows={14}
              className={`${inputCls} font-mono leading-relaxed`}
            />
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="block">
              <span className="text-sm text-ink/70">Phút đọc</span>
              <input
                name="est_minutes"
                type="number"
                defaultValue={l.est_minutes}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">XP thưởng</span>
              <input
                name="xp_reward"
                type="number"
                defaultValue={l.xp_reward}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Chương</span>
              <select
                name="module_id"
                defaultValue={l.module_id ?? ""}
                className={inputCls}
              >
                <option value="">Không xếp</option>
                {mods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                name="published"
                defaultChecked={l.published}
                className="w-4 h-4 accent-[var(--color-herb)]"
              />
              <span className="text-sm text-ink/70">Hiển thị</span>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <button className={buttonClass("primary")}>Lưu bài học</button>
            <form action={deleteLesson}>
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="course_id" value={courseId} />
              <button className="text-sm text-clay hover:underline">Xóa bài</button>
            </form>
          </div>
        </form>
      </Card>

      {/* Quiz */}
      <section>
        <h2 className="font-serif text-2xl mb-3">
          Quiz {quiz && <Badge accent="slate">{questions.length} câu</Badge>}
        </h2>

        <Card className="p-6 space-y-5">
          {/* Cấu hình quiz */}
          <form
            action={upsertQuiz}
            className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end"
          >
            <input type="hidden" name="lesson_id" value={l.id} />
            <input type="hidden" name="course_id" value={courseId} />
            <label className="block">
              <span className="text-sm text-ink/70">Tiêu đề quiz</span>
              <input
                name="title"
                defaultValue={quiz?.title ?? "Kiểm tra nhanh"}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Đạt (%)</span>
              <input
                name="pass_score"
                type="number"
                defaultValue={quiz?.pass_score ?? 70}
                className={`${inputCls} w-24`}
              />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">XP</span>
              <input
                name="xp_reward"
                type="number"
                defaultValue={quiz?.xp_reward ?? 30}
                className={`${inputCls} w-20`}
              />
            </label>
            <button className={buttonClass("outline")}>
              {quiz ? "Lưu" : "Tạo quiz"}
            </button>
          </form>

          {quiz && (
            <>
              <hr className="rule" />
              {/* Danh sách câu hỏi */}
              {questions.length > 0 && (
                <ol className="space-y-3">
                  {questions.map((q, i) => (
                    <li
                      key={q.id}
                      className="rounded-lg border border-ink/10 bg-paper-2 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">
                          <span className="font-mono text-ink/40 mr-1">
                            {i + 1}.
                          </span>
                          {q.prompt}
                        </p>
                        <form action={deleteQuestion}>
                          <input type="hidden" name="id" value={q.id} />
                          <input type="hidden" name="lesson_id" value={l.id} />
                          <input type="hidden" name="course_id" value={courseId} />
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
                    </li>
                  ))}
                </ol>
              )}

              {/* Thêm câu hỏi */}
              <form
                action={addQuestion}
                className="space-y-3 rounded-lg border border-dashed border-ink/20 p-4"
              >
                <input type="hidden" name="quiz_id" value={quiz.id} />
                <input type="hidden" name="lesson_id" value={l.id} />
                <input type="hidden" name="course_id" value={courseId} />
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
                    <span className="text-sm text-ink/70">Giải thích (hiện sau khi nộp)</span>
                    <input name="explanation" className={inputCls} />
                  </label>
                </div>
                <button className={buttonClass("primary")}>+ Thêm câu hỏi</button>
              </form>
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
