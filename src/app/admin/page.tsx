import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Eyebrow, ButtonLink, Stat } from "@/components/ui";

export default async function AdminOverview() {
  const supabase = await createClient();
  const [courses, learners, lessons, attempts] = await Promise.all([
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "learner"),
    supabase.from("lessons").select("id", { count: "exact", head: true }),
    supabase.from("quiz_attempts").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <Eyebrow>Quản trị</Eyebrow>
        <h1 className="font-serif text-3xl sm:text-4xl mt-2">Tổng quan</h1>
        <p className="text-ink/60 mt-2">
          Soạn khóa học, tạo tài khoản học viên, và theo dõi tiến bộ.
        </p>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-5">
          <Stat value={courses.count ?? 0} label="Khóa học" accent="amber" />
        </Card>
        <Card className="p-5">
          <Stat value={lessons.count ?? 0} label="Bài học" accent="herb" />
        </Card>
        <Card className="p-5">
          <Stat value={learners.count ?? 0} label="Học viên" accent="slate" />
        </Card>
        <Card className="p-5">
          <Stat value={attempts.count ?? 0} label="Lượt làm quiz" />
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="font-serif text-xl">Khóa học</h2>
          <p className="text-sm text-ink/60 mt-1 mb-4">
            Tạo và sắp xếp bài học, quiz cho từng khóa.
          </p>
          <ButtonLink href="/admin/khoa-hoc" variant="outline">
            Quản lý khóa học
          </ButtonLink>
        </Card>
        <Card className="p-6">
          <h2 className="font-serif text-xl">Học viên</h2>
          <p className="text-sm text-ink/60 mt-1 mb-4">
            Tạo tài khoản, ghi danh và xem tiến độ học.
          </p>
          <ButtonLink href="/admin/hoc-vien" variant="outline">
            Quản lý học viên
          </ButtonLink>
        </Card>
      </div>

      <p className="text-sm text-ink/50">
        Mẹo: bài học viết bằng <Link href="/admin/khoa-hoc" className="link">Markdown</Link>{" "}
        — dùng <code className="font-mono">## tiêu đề</code>,{" "}
        <code className="font-mono">- gạch đầu dòng</code>,{" "}
        <code className="font-mono">**đậm**</code>.
      </p>
    </div>
  );
}
