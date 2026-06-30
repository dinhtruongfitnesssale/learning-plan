import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Eyebrow, Badge } from "@/components/ui";
import { upsertModuleQuiz } from "../../../../actions";
import { QuizConfigForm } from "../../bai/[lessonSlug]/QuizConfigForm";
import { QuizQuestionsEditor } from "@/components/admin/QuizQuestionsEditor";
import type { Module, Quiz, QuizQuestion } from "@/lib/supabase/types";

export default async function ModuleQuizEditor({
  params,
}: {
  params: Promise<{ slug: string; moduleId: string }>;
}) {
  const { slug, moduleId } = await params;
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!course) notFound();

  const { data: moduleRow } = await supabase
    .from("modules")
    .select("*")
    .eq("id", moduleId)
    .eq("course_id", course.id)
    .maybeSingle();
  if (!moduleRow) notFound();
  const mod = moduleRow as Module;

  const { data: quizRow } = await supabase
    .from("quizzes")
    .select("*")
    .eq("module_id", moduleId)
    .maybeSingle();
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

  const path = `/admin/khoa-hoc/${slug}/chuong/${moduleId}`;

  return (
    <div className="space-y-7">
      <Link href={`/admin/khoa-hoc/${slug}`} className="link text-sm">
        ← Về khóa học
      </Link>

      <section>
        <Eyebrow>Kiểm tra chương</Eyebrow>
        <h1 className="font-serif text-3xl mt-1">{mod.title}</h1>
        <p className="text-ink/60 mt-2">
          Học viên phải ĐẠT bài kiểm tra này mới học được chương kế tiếp.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-2xl mb-3">
          Quiz {quiz && <Badge accent="slate">{questions.length} câu</Badge>}
        </h2>

        <Card className="p-6 space-y-5">
          <QuizConfigForm
            quiz={quiz}
            action={upsertModuleQuiz}
            hidden={{ module_id: moduleId, path }}
            defaultTitle="Kiểm tra chương"
          />

          {quiz && (
            <>
              <hr className="rule" />
              <QuizQuestionsEditor
                quizId={quiz.id}
                questions={questions}
                path={path}
              />
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
