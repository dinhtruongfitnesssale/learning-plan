import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLessonView } from "@/lib/data";
import { Markdown } from "@/components/Markdown";
import { VideoEmbed } from "@/components/VideoEmbed";
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
  // Chưa được duyệt → quay về trang khóa (hiện trạng thái chờ duyệt).
  if (data.locked) redirect(`/hoc/khoa/${slug}`);

  const { course, lesson, done, hasQuiz, bestPercent, prev, next } = data;
  const pdfEmbed = lesson.pdf_url ? pdfEmbedSrc(lesson.pdf_url) : "";
  const pdfIsDrive = pdfEmbed.includes("drive.google.com");

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

      {lesson.video_url && <VideoEmbed url={lesson.video_url} />}

      {lesson.content.trim() && <Markdown>{lesson.content}</Markdown>}

      {lesson.pdf_url && (
        <section className="rounded-[var(--radius-card)] border border-ink/10 bg-paper-2 p-5 lg:w-[min(94vw,1200px)] lg:relative lg:left-1/2 lg:-translate-x-1/2">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl">📄</span>
              <span className="font-medium truncate">
                {lesson.pdf_name || "Tài liệu bài học"}
              </span>
            </div>
            {lesson.allow_download ? (
              <a
                href={lesson.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="link text-sm shrink-0"
              >
                Mở / Tải về
              </a>
            ) : (
              <span className="text-xs text-ink/45 shrink-0">Chỉ xem trong bài</span>
            )}
          </div>
          <div className="relative w-full overflow-hidden rounded-lg border border-ink/10 bg-paper h-[75vh] lg:h-[88vh]">
            <iframe
              src={pdfEmbed}
              className="w-full h-full"
              title={lesson.pdf_name || "Tài liệu PDF"}
            />
            {/* Google Drive không cho ẩn thanh công cụ qua URL — chặn vùng
                nút pop-out (góc trên phải) và nút phóng to (góc dưới phải)
                để học viên không mở/tải tài liệu ra ngoài. */}
            {pdfIsDrive && (
              <>
                <div
                  aria-hidden
                  className="absolute right-0 top-0 h-14 w-24 cursor-default"
                />
                <div
                  aria-hidden
                  className="absolute bottom-0 right-0 h-20 w-32 cursor-default"
                />
              </>
            )}
          </div>
        </section>
      )}

      {hasQuiz && (
        <Quiz kind="lesson" targetId={lesson.id} bestPercent={bestPercent} />
      )}

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

// Chuyển link PDF sang dạng nhúng được trong iframe.
function pdfEmbedSrc(url: string): string {
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  // Link Drive dạng open?id=FILE_ID
  const open = url.match(/[?&]id=([\w-]+)/);
  if (open && url.includes("drive.google.com"))
    return `https://drive.google.com/file/d/${open[1]}/preview`;
  // PDF trực tiếp: ẩn thanh công cụ (tải/in/phóng to) của trình xem.
  return `${url}#toolbar=0&navpanes=0&scrollbar=0`;
}
