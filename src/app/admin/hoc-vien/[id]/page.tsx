import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getLearnerDetail } from "@/lib/data";
import { Card, Eyebrow, Badge, Stat } from "@/components/ui";
import { ProgressRing } from "@/components/ProgressRing";

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
    </div>
  );
}
