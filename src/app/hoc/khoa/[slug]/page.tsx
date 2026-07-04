import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCourseDetail, getCategories } from "@/lib/data";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import { ProgressRing } from "@/components/ProgressRing";
import { Pagination } from "@/components/Pagination";
import { requestEnroll, requestRelearn } from "../../khoa-hoc/actions";
import type { Lesson } from "@/lib/supabase/types";

const MODULES_PER_PAGE = 4;

type LessonItem = {
  lesson: Lesson;
  done: boolean;
  hasQuiz: boolean;
  locked: boolean;
};

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { user } = await requireUser();
  const data = await getCourseDetail(slug, user.id);
  if (!data) notFound();

  const { course, lessons, enrollStatus, approved, done, total, leaderboard } =
    data;
  const percent = total ? done / total : 0;
  const modInfo = new Map(data.moduleInfo.map((mi) => [mi.id, mi]));
  const categories = await getCategories();
  const ct = categories.find((c) => c.slug === course.category);

  // Gộp bài theo chương (giữ thứ tự chương), chỉ giữ chương có bài.
  const moduleGroups = data.modules
    .map((m) => ({
      module: m,
      lessons: lessons.filter((it) => it.lesson.module_id === m.id),
    }))
    .filter((g) => g.lessons.length > 0);
  // Bài không thuộc chương nào — hiện thẳng, không gấp trong accordion.
  const ungrouped = lessons.filter((it) => !it.lesson.module_id);

  // Phân trang: mỗi trang tối đa 4 chương. Bài lẻ chỉ hiện ở trang 1.
  const totalPages = Math.max(
    1,
    Math.ceil(moduleGroups.length / MODULES_PER_PAGE),
  );
  const page = Math.min(totalPages, Math.max(1, Number(sp.page) || 1));
  const from = (page - 1) * MODULES_PER_PAGE;
  const pageGroups = moduleGroups.slice(from, from + MODULES_PER_PAGE);

  // Ô số thứ tự / trạng thái ở đầu mỗi dòng bài.
  const renderLesson = (item: LessonItem, i: number) => {
    const { lesson, done: ldone, hasQuiz, locked } = item;
    const lessonLocked = !approved || locked;
    const row = (
      <Card
        className={`px-4 py-3.5 flex items-center gap-4 ${
          lessonLocked ? "opacity-70" : "hover:border-ink/25 transition-colors"
        }`}
      >
        <span
          className={`grid place-items-center w-8 h-8 rounded-full text-sm font-mono shrink-0 ${
            ldone ? "bg-herb text-paper" : "bg-paper-2 text-ink/50"
          }`}
        >
          {lessonLocked ? "🔒" : ldone ? "✓" : i + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{lesson.title}</div>
          <div className="text-xs text-ink/50 mt-0.5">{lesson.summary}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lesson.video_url && <span title="Có video">🎥</span>}
          {lesson.pdf_url && <span title="Có tài liệu PDF">📄</span>}
          {hasQuiz && <Badge accent="slate">quiz</Badge>}
          <span className="font-mono text-xs text-ink/40 tnum">
            {lesson.est_minutes}′
          </span>
        </div>
      </Card>
    );
    return (
      <li key={lesson.id}>
        {!lessonLocked ? (
          <Link href={`/hoc/khoa/${course.slug}/${lesson.slug}`}>{row}</Link>
        ) : (
          row
        )}
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <Link href="/hoc/khoa-hoc" className="link text-sm">
        ← Tất cả khóa
      </Link>

      {/* Header khóa */}
      <header className="flex flex-col sm:flex-row sm:items-center gap-5">
        <ProgressRing value={percent} accent={course.accent} size={88} stroke={8} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{course.cover_emoji}</span>
            <Badge accent={ct?.accent ?? "amber"}>
              {ct?.label ?? "Khóa học"}
            </Badge>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl mt-1">{course.title}</h1>
          <p className="text-ink/60 mt-2 max-w-xl">{course.summary}</p>
          {approved && (
            <p className="font-mono text-xs text-ink/50 mt-2 tnum">
              {done}/{total} bài · {Math.round(percent * 100)}% hoàn thành
            </p>
          )}
        </div>
        {enrollStatus === "pending" ? (
          <Badge accent="slate">⏳ Đang chờ duyệt</Badge>
        ) : enrollStatus === "failed" ? (
          <form action={requestRelearn}>
            <input type="hidden" name="course_id" value={course.id} />
            <input type="hidden" name="slug" value={course.slug} />
            <button className={buttonClass("primary")}>Yêu cầu học lại</button>
          </form>
        ) : !approved ? (
          <form action={requestEnroll}>
            <input type="hidden" name="course_id" value={course.id} />
            <input type="hidden" name="slug" value={course.slug} />
            <button className={buttonClass("primary")}>Yêu cầu học</button>
          </form>
        ) : null}
      </header>

      {/* Banner trạng thái khi chưa được học */}
      {!approved && (
        <Card
          className={`p-5 ${
            enrollStatus === "failed" ? "bg-clay-soft" : "bg-paper-2"
          }`}
        >
          <p className="text-sm text-ink/70">
            {enrollStatus === "pending"
              ? "🔒 Yêu cầu của bạn đang chờ coach duyệt. Khi được duyệt, bạn sẽ vào học được ngay."
              : enrollStatus === "failed"
                ? "🔒 Bạn đã làm sai quiz quá 2 lần nên khóa học này bị khóa. Bấm “Yêu cầu học lại” để coach mở lại — bạn sẽ có 2 lượt làm mới."
                : "🔒 Bạn chưa được ghi danh. Bấm “Yêu cầu học” để coach duyệt."}
          </p>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-8 items-start">
        {/* Danh sách bài học */}
        <div className="space-y-5">
          {total === 0 && (
            <Card className="p-6 text-ink/60">Khóa đang được soạn bài.</Card>
          )}

          {/* Bài lẻ (không thuộc chương) — hiện thẳng, chỉ ở trang 1 */}
          {page === 1 && ungrouped.length > 0 && (
            <ol className="space-y-2.5">
              {ungrouped.map((item, i) => renderLesson(item, i))}
            </ol>
          )}

          {/* Các chương — gấp lại, ấn để mở */}
          {pageGroups.map((g, gi) => {
            const info = modInfo.get(g.module.id);
            const chapterLocked = info?.locked ?? false;
            const number = from + gi + 1;
            const lessonsDone = g.lessons.filter((it) => it.done).length;
            return (
              <details
                key={g.module.id}
                className="group rounded-[var(--radius-card)] border border-ink/10 bg-paper shadow-[var(--shadow-soft)] overflow-hidden"
              >
                <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center gap-3 px-4 py-3.5 hover:bg-paper-2 transition-colors">
                  <span className="text-ink/40 transition-transform group-open:rotate-90 shrink-0">
                    ▸
                  </span>
                  <span className="eyebrow shrink-0">Chương {number}</span>
                  <span className="font-medium flex-1 min-w-0 truncate">
                    {g.module.title}
                  </span>
                  {approved && chapterLocked && <span title="Đang khóa">🔒</span>}
                  <span className="font-mono text-xs text-ink/40 tnum shrink-0">
                    {lessonsDone}/{g.lessons.length} bài
                  </span>
                </summary>

                <div className="px-4 pb-4 pt-1 border-t border-ink/10">
                  <ol className="space-y-2.5">
                    {g.lessons.map((item, i) => renderLesson(item, i))}
                  </ol>

                  {/* Bài kiểm tra chương */}
                  {approved && info?.hasQuiz && (
                    <div className="mt-3">
                      {info.quizPassed ? (
                        <Card className="px-4 py-3.5 flex items-center gap-3 bg-herb-soft">
                          <span className="text-xl shrink-0">🏅</span>
                          <span className="font-medium flex-1">
                            Bài kiểm tra chương
                          </span>
                          <Badge accent="herb">✓ Đã đạt</Badge>
                        </Card>
                      ) : info.quizAvailable ? (
                        <Link
                          href={`/hoc/khoa/${course.slug}/chuong/${g.module.id}`}
                        >
                          <Card className="px-4 py-3.5 flex items-center gap-3 bg-amber-soft hover:border-ink/25 transition-colors">
                            <span className="text-xl shrink-0">📝</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">
                                Bài kiểm tra chương
                              </div>
                              <div className="text-xs text-ink/55">
                                Đạt để mở khóa chương kế tiếp
                              </div>
                            </div>
                            <span className={buttonClass("primary", "shrink-0")}>
                              Làm bài →
                            </span>
                          </Card>
                        </Link>
                      ) : (
                        <Card className="px-4 py-3.5 flex items-center gap-3 opacity-70">
                          <span className="text-xl shrink-0">🔒</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">Bài kiểm tra chương</div>
                            <div className="text-xs text-ink/55">
                              {chapterLocked
                                ? "Hoàn thành chương trước để mở."
                                : `Học hết các bài trong chương (${info.lessonsDone}/${info.lessonsTotal}) để mở.`}
                            </div>
                          </div>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              </details>
            );
          })}

          <Pagination
            basePath={`/hoc/khoa/${course.slug}`}
            page={page}
            totalPages={totalPages}
          />
        </div>

        {/* Bảng xếp hạng tuần (chỉ khi đã được học) */}
        {approved && (
          <aside>
            <Card className="p-5 sticky top-20">
              <div className="flex items-center justify-between">
                <Eyebrow>Đua tuần này</Eyebrow>
                <Badge accent="amber">XP/tuần</Badge>
              </div>
              <p className="text-xs text-ink/50 mt-1 mb-3">
                Chỉ trong khóa này — đủ nhỏ để bạn thắng.
              </p>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-ink/50">
                  Chưa có ai. Học bài để dẫn đầu!
                </p>
              ) : (
                <ol className="space-y-1">
                  {leaderboard.slice(0, 8).map((row) => {
                    const me = row.user_id === user.id;
                    return (
                      <li
                        key={row.user_id}
                        className={`flex items-center gap-3 rounded-lg px-2.5 py-1.5 ${
                          me ? "bg-amber-soft" : ""
                        }`}
                      >
                        <span className="font-mono text-xs text-ink/50 w-5 tnum">
                          {row.rnk}
                        </span>
                        <span className="flex-1 text-sm truncate">
                          {row.full_name || "Học viên"}
                          {me && <span className="text-amber"> · bạn</span>}
                        </span>
                        <span className="font-mono text-sm font-semibold tnum">
                          {row.xp_week}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}
