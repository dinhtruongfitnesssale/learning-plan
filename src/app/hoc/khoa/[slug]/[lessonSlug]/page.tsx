import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLessonView } from "@/lib/data";
import { Markdown } from "@/components/Markdown";
import { Quiz } from "@/components/Quiz";
import { LessonComplete } from "@/components/LessonComplete";
import { Eyebrow, Badge } from "@/components/ui";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug } = await params;
  const { user } = await requireUser();
  const data = await getLessonView(slug, lessonSlug, user.id);
  if (!data) notFound();

  const { course, lesson, done, hasQuiz, bestPercent, prev, next } = data;

  return (
    <article className="max-w-2xl mx-auto space-y-7">
      <Link href={`/hoc/khoa/${course.slug}`} className="link text-sm">
        ← {course.title}
      </Link>

      <header>
        <div className="flex items-center gap-2">
          <Eyebrow>Bài học</Eyebrow>
          <span className="font-mono text-xs text-ink/40 tnum">
            {lesson.est_minutes}′ · {lesson.xp_reward} XP
          </span>
          {done && <Badge accent="herb">✓ đã học</Badge>}
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl mt-2">{lesson.title}</h1>
        {lesson.summary && (
          <p className="text-lg text-ink/60 mt-2">{lesson.summary}</p>
        )}
      </header>

      <hr className="rule" />

      <Markdown>{lesson.content}</Markdown>

      {hasQuiz && <Quiz lessonId={lesson.id} bestPercent={bestPercent} />}

      <LessonComplete
        lessonId={lesson.id}
        courseSlug={course.slug}
        nextSlug={next?.slug ?? null}
        initialDone={done}
      />

      {/* Điều hướng trước/sau */}
      <nav className="flex items-center justify-between pt-2 text-sm">
        {prev ? (
          <Link href={`/hoc/khoa/${course.slug}/${prev.slug}`} className="link">
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/hoc/khoa/${course.slug}/${next.slug}`} className="link">
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
