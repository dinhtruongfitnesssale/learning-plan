import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import {
  updateCourse,
  toggleCoursePublish,
  deleteCourse,
  createModule,
  createLesson,
} from "../../actions";
import type { Course, Lesson, Module } from "@/lib/supabase/types";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

export default async function CourseEditor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!course) notFound();
  const c = course as Course;

  const [{ data: modules }, { data: lessons }] = await Promise.all([
    supabase.from("modules").select("*").eq("course_id", id).order("sort_order"),
    supabase.from("lessons").select("*").eq("course_id", id).order("sort_order"),
  ]);
  const mods = (modules as Module[]) ?? [];
  const lessonList = (lessons as Lesson[]) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/admin/khoa-hoc" className="link text-sm">
          ← Tất cả khóa
        </Link>
        <div className="flex items-center gap-2">
          <form action={toggleCoursePublish}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="published" value={String(c.published)} />
            <button className={buttonClass(c.published ? "outline" : "primary")}>
              {c.published ? "Chuyển về nháp" : "Xuất bản"}
            </button>
          </form>
          <Link href={`/hoc/khoa/${c.slug}`} className={buttonClass("ghost")}>
            Xem trước
          </Link>
        </div>
      </div>

      <section className="flex items-center gap-3">
        <span className="text-3xl">{c.cover_emoji}</span>
        <div>
          <Eyebrow>Sửa khóa học</Eyebrow>
          <h1 className="font-serif text-3xl">{c.title}</h1>
        </div>
        <Badge accent={c.published ? "herb" : "ink"} className="ml-auto">
          {c.published ? "Đã xuất bản" : "Nháp"}
        </Badge>
      </section>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Bài học */}
        <div className="space-y-6">
          <div>
            <h2 className="font-serif text-2xl mb-3">Bài học</h2>
            {lessonList.length === 0 ? (
              <Card className="p-5 text-ink/60 text-sm">
                Chưa có bài học. Thêm bài ở khung bên phải.
              </Card>
            ) : (
              <ol className="space-y-2">
                {lessonList.map((l, i) => (
                  <li key={l.id}>
                    <Link href={`/admin/khoa-hoc/${c.id}/bai/${l.id}`}>
                      <Card className="px-4 py-3 flex items-center gap-3 hover:border-ink/25 transition-colors">
                        <span className="font-mono text-sm text-ink/40 w-5 tnum">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{l.title}</div>
                          <div className="text-xs text-ink/45 font-mono">
                            {mods.find((m) => m.id === l.module_id)?.title ??
                              "Chưa xếp chương"}{" "}
                            · {l.xp_reward} XP
                          </div>
                        </div>
                        {!l.published && <Badge accent="ink">ẩn</Badge>}
                      </Card>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Thêm bài */}
          <Card className="p-5">
            <h3 className="font-serif text-lg mb-3">Thêm bài học</h3>
            <form action={createLesson} className="flex flex-col sm:flex-row gap-2">
              <input type="hidden" name="course_id" value={c.id} />
              <input
                name="title"
                required
                placeholder="Tên bài học"
                className={inputCls}
              />
              <select name="module_id" className={`${inputCls} sm:w-44`}>
                <option value="">Không xếp chương</option>
                {mods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
              <button className={buttonClass("primary", "shrink-0")}>Thêm</button>
            </form>
          </Card>
        </div>

        {/* Cột phải: thông tin khóa + chương */}
        <div className="space-y-5">
          <Card className="p-5" as="section">
            <h3 className="font-serif text-lg mb-3">Thông tin khóa</h3>
            <form action={updateCourse} className="space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <label className="block">
                <span className="text-sm text-ink/70">Tên khóa</span>
                <input name="title" defaultValue={c.title} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-sm text-ink/70">Mô tả</span>
                <textarea
                  name="summary"
                  rows={3}
                  defaultValue={c.summary}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink/70">Loại khóa</span>
                <select name="category" defaultValue={c.category} className={inputCls}>
                  <option value="dinh_duong">🍲 Dinh dưỡng</option>
                  <option value="tap_luyen">🏃 Tập luyện</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-ink/70">Biểu tượng</span>
                  <input
                    name="cover_emoji"
                    defaultValue={c.cover_emoji}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-ink/70">Màu</span>
                  <select name="accent" defaultValue={c.accent} className={inputCls}>
                    <option value="amber">Amber</option>
                    <option value="herb">Herb</option>
                    <option value="slate">Slate</option>
                    <option value="clay">Clay</option>
                  </select>
                </label>
              </div>
              <button className={buttonClass("outline", "w-full")}>Lưu</button>
            </form>
          </Card>

          <Card className="p-5" as="section">
            <h3 className="font-serif text-lg mb-3">Chương</h3>
            {mods.length > 0 && (
              <ul className="text-sm text-ink/70 space-y-1 mb-3">
                {mods.map((m, i) => (
                  <li key={m.id} className="font-mono">
                    {i + 1}. {m.title}
                  </li>
                ))}
              </ul>
            )}
            <form action={createModule} className="flex gap-2">
              <input type="hidden" name="course_id" value={c.id} />
              <input
                name="title"
                required
                placeholder="Tên chương"
                className={inputCls}
              />
              <button className={buttonClass("ghost", "shrink-0")}>+ Thêm</button>
            </form>
          </Card>

          <form action={deleteCourse}>
            <input type="hidden" name="id" value={c.id} />
            <button className="text-sm text-clay hover:underline">
              Xóa khóa học này
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
