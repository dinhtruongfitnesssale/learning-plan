import { requireCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildLessonWorkbook } from "@/lib/lesson-import";
import { slugify } from "@/lib/slug";

// GET /admin/khoa-hoc/<slug>/excel → file Excel chương + bài học của khóa,
// điền sẵn bài hiện có, để coach sửa rồi tải lên lại.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  await requireCoach(); // học viên / khách bị đẩy đi nơi khác
  const { slug } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!course) return new Response("Không tìm thấy khóa học", { status: 404 });

  const [{ data: mods }, { data: lessons }] = await Promise.all([
    supabase
      .from("modules")
      .select("id, title, sort_order")
      .eq("course_id", course.id)
      .order("sort_order")
      .order("id"),
    supabase
      .from("lessons")
      .select("module_id, title, slug, summary, content, video_url, pdf_url, pdf_name, est_minutes, published, sort_order, id")
      .eq("course_id", course.id),
  ]);

  // Cùng thứ tự với trang khóa học: bài chưa xếp chương trước, rồi theo chương.
  const modList = mods ?? [];
  const rank = new Map(modList.map((m, i) => [m.id, i]));
  const title = new Map(modList.map((m) => [m.id, m.title as string]));
  const sorted = [...(lessons ?? [])].sort(
    (a, b) =>
      (a.module_id ? rank.get(a.module_id) ?? modList.length : -1) -
        (b.module_id ? rank.get(b.module_id) ?? modList.length : -1) ||
      a.sort_order - b.sort_order ||
      String(a.id).localeCompare(String(b.id)),
  );

  const buffer = buildLessonWorkbook(
    sorted.map((l) => ({
      chapter: l.module_id ? title.get(l.module_id) ?? "" : "",
      title: l.title,
      summary: l.summary,
      video_url: l.video_url,
      pdf_url: l.pdf_url,
      pdf_name: l.pdf_name,
      content: l.content,
      est_minutes: l.est_minutes,
      published: l.published,
      slug: l.slug,
    })),
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bai-hoc-${slugify(course.slug) || "khoa"}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
