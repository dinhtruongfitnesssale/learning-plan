import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Eyebrow, Badge } from "@/components/ui";
import { upsertQuiz, deleteQuiz } from "../../../../actions";
import { LessonEditForm } from "./LessonEditForm";
import { QuizConfigForm } from "./QuizConfigForm";
import { QuizQuestionsEditor } from "@/components/admin/QuizQuestionsEditor";
import { DeleteQuizButton } from "@/components/admin/DeleteQuizButton";
import type { Lesson, Module, Quiz, QuizQuestion } from "@/lib/supabase/types";

export default async function LessonEditor({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug } = await params;
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!course) notFound();
  const courseId = course.id as string;

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .eq("slug", lessonSlug)
    .maybeSingle();
  if (!lesson) notFound();
  const l = lesson as Lesson;
  const lessonId = l.id;

  const [{ data: modules }, { data: quizRow }] = await Promise.all([
    supabase
      .from("modules")
      .select("*")
      .eq("course_id", courseId)
      .order("sort_order")
      .order("id"),
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
      <Link href={`/admin/khoa-hoc/${slug}`} className="link text-sm">
        ← Về khóa học
      </Link>

      <section>
        <Eyebrow>Sửa bài học</Eyebrow>
        <h1 className="font-serif text-3xl mt-1">{l.title}</h1>
      </section>

      {/* Nội dung bài */}
      <LessonEditForm
        lesson={l}
        courseId={courseId}
        courseSlug={slug}
        modules={mods}
      />

      {/* Quiz */}
      <section>
        <h2 className="font-serif text-2xl mb-3">
          Quiz {quiz && <Badge accent="slate">{questions.length} câu</Badge>}
        </h2>

        <Card className="p-6 space-y-5">
          {/* Cấu hình quiz */}
          <QuizConfigForm
            quiz={quiz}
            action={upsertQuiz}
            hidden={{
              lesson_id: l.id,
              course_id: courseId,
              course_slug: slug,
              lesson_slug: l.slug,
            }}
          />

          {quiz && (
            <>
              <hr className="rule" />
              <QuizQuestionsEditor
                quizId={quiz.id}
                questions={questions}
                path={`/admin/khoa-hoc/${slug}/bai/${l.slug}`}
              />
              <hr className="rule" />
              <DeleteQuizButton
                action={deleteQuiz}
                hidden={{
                  quiz_id: quiz.id,
                  course_slug: slug,
                  lesson_slug: l.slug,
                }}
              />
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
