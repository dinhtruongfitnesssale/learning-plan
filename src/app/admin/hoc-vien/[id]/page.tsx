import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getLearnerDetail } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Card, Eyebrow, Badge, Stat, buttonClass } from "@/components/ui";
import { ProgressRing } from "@/components/ProgressRing";
import { CATEGORIES } from "@/lib/brand";
import { assignCourse, unassignCourse } from "../../actions";
import type { Course } from "@/lib/supabase/types";

const inputCls =
  "rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

export default async function LearnerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCoach();
  const { id } = await params;
  const data = await getLearnerDetail(id);
  if (!data) notFound();

  const { profile, totalXp, level, streak, courses, quizzes, lessonsDone } = data;

  // Dữ liệu cho mục phân khóa: tất cả khóa + trạng thái ghi danh của học viên này.
  const supabase = await createClient();
  const [{ data: allCourses }, { data: enrolls }] = await Promise.all([
    supabase.from("courses").select("*").order("sort_order"),
    supabase
      .from("enrollments")
      .select("course_id, status")
      .eq("user_id", id),
  ]);
  const statusByCourse = new Map(
    (enrolls ?? []).map((e) => [e.course_id, e.status as "pending" | "approved"]),
  );
  const courseList = (allCourses as Course[]) ?? [];
  const unassigned = courseList.filter((c) => !statusByCourse.has(c.id));

  return (
    <div className="space-y-8">
      <Link href="/admin/hoc-vien" className="link text-sm">
        ← Tất cả học viên
      </Link>

      <header className="flex items-center gap-4">
        <div className="grid place-items-center w-14 h-14 rounded-full bg-paper-2 font-serif text-2xl">
          {(profile.full_name || "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <Eyebrow>Học viên</Eyebrow>
          <h1 className="font-serif text-3xl">
            {profile.full_name || "(chưa đặt tên)"}
          </h1>
        </div>
        <Badge accent="amber" className="ml-auto">
          Lv{level.level} · {level.name}
        </Badge>
      </header>

      {/* Chỉ số */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-5">
          <Stat value={totalXp} label="Tổng XP" accent="amber" />
        </Card>
        <Card className="p-5">
          <Stat value={lessonsDone} label="Bài đã học" accent="herb" />
        </Card>
        <Card className="p-5">
          <Stat
            value={streak?.current_streak ?? 0}
            label="Chuỗi ngày"
            accent="slate"
          />
        </Card>
        <Card className="p-5">
          <Stat value={courses.length} label="Khóa ghi danh" />
        </Card>
      </div>

      {/* Tiến độ theo khóa */}
      <section>
        <h2 className="font-serif text-2xl mb-3">Tiến độ theo khóa</h2>
        {courses.length === 0 ? (
          <Card className="p-6 text-ink/60 text-sm">
            Chưa ghi danh khóa nào.
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {courses.map(({ course, done, total, percent }) => (
              <Card key={course.id} className="p-5 flex items-center gap-4">
                <ProgressRing
                  value={percent}
                  accent={course.accent}
                  label={
                    <span className="font-mono text-xs tnum">
                      {done}/{total}
                    </span>
                  }
                />
                <div className="min-w-0">
                  <div className="text-xl">{course.cover_emoji}</div>
                  <h3 className="font-serif text-lg truncate">{course.title}</h3>
                  <p className="text-xs text-ink/50 font-mono tnum">
                    {Math.round(percent * 100)}% hoàn thành
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Kết quả quiz (năng lực thật) */}
      <section>
        <h2 className="font-serif text-2xl mb-3">Kết quả kiểm tra</h2>
        {quizzes.length === 0 ? (
          <Card className="p-6 text-ink/60 text-sm">Chưa làm quiz nào.</Card>
        ) : (
          <Card className="divide-y divide-ink/10">
            {quizzes.map((q, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{q.title}</div>
                  <div className="text-xs text-ink/50 font-mono tnum">
                    {q.attempts} lượt làm
                  </div>
                </div>
                <Badge accent={q.passed ? "herb" : "clay"}>
                  {q.passed ? "Đạt" : "Chưa đạt"}
                </Badge>
                <span className="font-mono text-lg font-semibold tnum w-14 text-right">
                  {q.best}%
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Phân khóa học */}
      <section>
        <h2 className="font-serif text-2xl mb-3">Phân khóa học</h2>
        <Card className="p-5 space-y-4">
          {/* Gán khóa mới */}
          <form action={assignCourse} className="flex flex-wrap gap-2 items-center">
            <input type="hidden" name="user_id" value={id} />
            <select name="course_id" required className={`${inputCls} flex-1 min-w-[200px]`} defaultValue="">
              <option value="" disabled>
                Chọn khóa để gán…
              </option>
              {unassigned.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cover_emoji} {c.title} ({CATEGORIES[c.category]?.label})
                </option>
              ))}
            </select>
            <button
              disabled={unassigned.length === 0}
              className={buttonClass("primary")}
            >
              Gán &amp; duyệt
            </button>
          </form>
          {unassigned.length === 0 && (
            <p className="text-xs text-ink/45">Học viên đã có mặt ở tất cả khóa.</p>
          )}

          {/* Khóa đang ghi danh */}
          {statusByCourse.size > 0 && (
            <div className="divide-y divide-ink/10 border-t border-ink/10 pt-1">
              {courseList
                .filter((c) => statusByCourse.has(c.id))
                .map((c) => {
                  const st = statusByCourse.get(c.id);
                  return (
                    <div key={c.id} className="flex items-center gap-3 py-2.5">
                      <span className="text-xl shrink-0">{c.cover_emoji}</span>
                      <span className="flex-1 min-w-0 truncate">{c.title}</span>
                      <Badge accent={st === "approved" ? "herb" : "slate"}>
                        {st === "approved" ? "Đang học" : "Chờ duyệt"}
                      </Badge>
                      {st === "pending" && (
                        <form action={assignCourse}>
                          <input type="hidden" name="user_id" value={id} />
                          <input type="hidden" name="course_id" value={c.id} />
                          <button className={buttonClass("ghost", "!px-3 !py-1.5 text-xs")}>
                            Duyệt
                          </button>
                        </form>
                      )}
                      <form action={unassignCourse}>
                        <input type="hidden" name="user_id" value={id} />
                        <input type="hidden" name="course_id" value={c.id} />
                        <button className="text-xs text-clay hover:underline shrink-0">
                          Gỡ
                        </button>
                      </form>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
