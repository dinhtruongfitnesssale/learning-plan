import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCourseDetail } from "@/lib/data";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import { ProgressRing } from "@/components/ProgressRing";
import { CATEGORIES } from "@/lib/brand";
import { requestEnroll } from "../../khoa-hoc/actions";
import type { Lesson } from "@/lib/supabase/types";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireUser();
  const data = await getCourseDetail(slug, user.id);
  if (!data) notFound();

  const { course, lessons, enrollStatus, approved, done, total, leaderboard } =
    data;
  const percent = total ? done / total : 0;
  const grouped = groupByModule(data.modules, lessons);

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
            <Badge accent={course.category === "tap_luyen" ? "herb" : "amber"}>
              {CATEGORIES[course.category]?.label ?? "Khóa học"}
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
        <Card className="p-5 bg-paper-2">
          <p className="text-sm text-ink/70">
            {enrollStatus === "pending"
              ? "🔒 Yêu cầu của bạn đang chờ coach duyệt. Khi được duyệt, bạn sẽ vào học được ngay."
              : "🔒 Bạn chưa được ghi danh. Bấm “Yêu cầu học” để coach duyệt."}
          </p>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-8 items-start">
        {/* Danh sách bài học */}
        <div className="space-y-7">
          {total === 0 && (
            <Card className="p-6 text-ink/60">Khóa đang được soạn bài.</Card>
          )}
          {grouped.map((g, gi) => (
            <section key={g.title ?? gi}>
              {g.title && (
                <h2 className="eyebrow mb-3">
                  Chương {gi + 1} · {g.title}
                </h2>
              )}
              <ol className="space-y-2.5">
                {g.lessons.map(({ lesson, done, hasQuiz }, i) => {
                  const row = (
                    <Card
                      className={`px-4 py-3.5 flex items-center gap-4 ${
                        approved ? "hover:border-ink/25 transition-colors" : "opacity-70"
                      }`}
                    >
                      <span
                        className={`grid place-items-center w-8 h-8 rounded-full text-sm font-mono shrink-0 ${
                          done ? "bg-herb text-paper" : "bg-paper-2 text-ink/50"
                        }`}
                      >
                        {approved ? (done ? "✓" : i + 1) : "🔒"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{lesson.title}</div>
                        <div className="text-xs text-ink/50 mt-0.5">
                          {lesson.summary}
                        </div>
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
                      {approved ? (
                        <Link href={`/hoc/khoa/${course.slug}/${lesson.slug}`}>
                          {row}
                        </Link>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
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

function groupByModule(
  modules: { id: string; title: string }[],
  lessons: { lesson: Lesson; done: boolean; hasQuiz: boolean }[],
) {
  const groups: { title: string | null; lessons: typeof lessons }[] = [];
  const byId = new Map<string, (typeof groups)[number]>();
  const noModule: (typeof groups)[number] = { title: null, lessons: [] };

  for (const m of modules) {
    const g = { title: m.title, lessons: [] as typeof lessons };
    byId.set(m.id, g);
    groups.push(g);
  }
  for (const item of lessons) {
    const mid = item.lesson.module_id;
    if (mid && byId.has(mid)) byId.get(mid)!.lessons.push(item);
    else noModule.lessons.push(item);
  }
  if (noModule.lessons.length) groups.push(noModule);
  return groups.filter((g) => g.lessons.length > 0);
}
