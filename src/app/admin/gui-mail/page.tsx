import { createClient } from "@/lib/supabase/server";
import { requireCoach } from "@/lib/auth";
import { Eyebrow } from "@/components/ui";
import { GuiMailForm } from "./GuiMailForm";
import type { Course, Profile } from "@/lib/supabase/types";

export default async function GuiMailPage() {
  await requireCoach();
  const supabase = await createClient();

  const [{ data: profiles }, { data: courses }, { data: enr }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "learner")
        .order("full_name", { ascending: true }),
      supabase
        .from("courses")
        .select("id, title, cover_emoji")
        .order("sort_order", { ascending: true }),
      supabase.from("enrollments").select("course_id").eq("status", "approved"),
    ]);

  const learners = (profiles as Pick<Profile, "id" | "full_name" | "email">[]) ?? [];

  // Số học viên đã duyệt của từng khóa — để hiện gợi ý khi chọn khóa.
  const countByCourse = new Map<string, number>();
  (enr ?? []).forEach((e) =>
    countByCourse.set(e.course_id, (countByCourse.get(e.course_id) ?? 0) + 1),
  );
  const courseList = (
    (courses as Pick<Course, "id" | "title" | "cover_emoji">[]) ?? []
  ).map((c) => ({ ...c, learners: countByCourse.get(c.id) ?? 0 }));

  return (
    <div className="space-y-8">
      <section>
        <Eyebrow>Quản trị · Gửi mail</Eyebrow>
        <h1 className="font-serif text-3xl mt-2">Gửi mail cho học viên</h1>
        <p className="text-ink/60 mt-2">
          Soạn nội dung, chọn người nhận rồi gửi. Email được bọc sẵn trong khung
          thương hiệu cho đẹp mắt.
        </p>
      </section>

      <GuiMailForm learners={learners} courses={courseList} />
    </div>
  );
}
