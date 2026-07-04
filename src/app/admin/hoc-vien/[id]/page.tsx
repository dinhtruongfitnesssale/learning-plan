import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getLearnerDetail, getCategories } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Card, Eyebrow, Badge, Stat } from "@/components/ui";
import { ProgressRing } from "@/components/ProgressRing";
import { ManageLearner } from "./ManageLearner";
import { CourseAssignment } from "./CourseAssignment";
import { QuizResults } from "./QuizResults";
import type { Course } from "@/lib/supabase/types";

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
  const categories = await getCategories();
  const catLabel = new Map(categories.map((c) => [c.slug, c.label]));

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
        <QuizResults quizzes={quizzes} />
      </section>

      {/* Quản lý tài khoản */}
      <section>
        <h2 className="font-serif text-2xl mb-3">Quản lý tài khoản</h2>
        <ManageLearner
          id={profile.id}
          fullName={profile.full_name}
          email={profile.email}
        />
      </section>

      {/* Phân khóa học */}
      <section>
        <h2 className="font-serif text-2xl mb-3">Phân khóa học</h2>
        <Card className="p-5 space-y-4">
          <CourseAssignment
            userId={id}
            unassigned={unassigned.map((c) => ({
              id: c.id,
              title: c.title,
              cover_emoji: c.cover_emoji,
              categoryLabel: catLabel.get(c.category) ?? c.category,
            }))}
            enrolled={courseList
              .filter((c) => statusByCourse.has(c.id))
              .map((c) => ({
                id: c.id,
                title: c.title,
                cover_emoji: c.cover_emoji,
                status: statusByCourse.get(c.id)!,
              }))}
          />
        </Card>
      </section>
    </div>
  );
}
