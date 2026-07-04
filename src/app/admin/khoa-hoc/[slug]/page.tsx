import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/data";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import { Pagination } from "@/components/Pagination";
import { Chapter } from "@/components/Chapter";
import {
  updateCourse,
  toggleCoursePublish,
  deleteCourse,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
} from "../../actions";
import type { Course, Lesson, Module } from "@/lib/supabase/types";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

const MODULES_PER_PAGE = 4;

export default async function CourseEditor({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!course) notFound();
  const c = course as Course;

  const [{ data: modules }, { data: lessons }] = await Promise.all([
    supabase.from("modules").select("*").eq("course_id", c.id).order("sort_order"),
    supabase.from("lessons").select("*").eq("course_id", c.id).order("sort_order"),
  ]);
  const mods = (modules as Module[]) ?? [];
  const lessonList = (lessons as Lesson[]) ?? [];
  const categories = await getCategories();

  // Gộp bài theo chương (giữ cả chương chưa có bài để coach thấy).
  const moduleGroups = mods.map((m) => ({
    module: m,
    lessons: lessonList.filter((l) => l.module_id === m.id),
  }));
  // Bài chưa xếp chương — hiện thẳng, không gấp.
  const ungrouped = lessonList.filter((l) => !l.module_id);

  // Phân trang: mỗi trang tối đa 4 chương. Bài chưa xếp chương chỉ hiện ở trang 1.
  const totalPages = Math.max(
    1,
    Math.ceil(moduleGroups.length / MODULES_PER_PAGE),
  );
  const page = Math.min(totalPages, Math.max(1, Number(sp.page) || 1));
  const from = (page - 1) * MODULES_PER_PAGE;
  const pageGroups = moduleGroups.slice(from, from + MODULES_PER_PAGE);

  const lessonRow = (l: Lesson, i: number) => (
    <li key={l.id}>
      <Link href={`/admin/khoa-hoc/${c.slug}/bai/${l.slug}`}>
        <Card className="px-4 py-3 flex items-center gap-3 hover:border-ink/25 transition-colors">
          <span className="font-mono text-sm text-ink/40 w-5 tnum">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{l.title}</div>
            <div className="text-xs text-ink/45 font-mono">{l.xp_reward} XP</div>
          </div>
          {!l.published && <Badge accent="ink">ẩn</Badge>}
        </Card>
      </Link>
    </li>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/admin/khoa-hoc" className="link text-sm">
          ← Tất cả khóa
        </Link>
        <div className="flex items-center gap-2">
          <form action={toggleCoursePublish}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="slug" value={c.slug} />
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
          <div className="space-y-4">
            <h2 className="font-serif text-2xl">Bài học</h2>
            {lessonList.length === 0 ? (
              <Card className="p-5 text-ink/60 text-sm">
                Chưa có bài học. Thêm bài ở khung bên phải.
              </Card>
            ) : (
              <>
                {/* Bài chưa xếp chương — hiện thẳng, chỉ ở trang 1 */}
                {page === 1 && ungrouped.length > 0 && (
                  <div className="space-y-2">
                    <p className="eyebrow">Chưa xếp chương</p>
                    <ol className="space-y-2">
                      {ungrouped.map((l, i) => lessonRow(l, i))}
                    </ol>
                  </div>
                )}

                {/* Các chương — gấp lại, ấn để mở */}
                {pageGroups.map((g, gi) => (
                  <Chapter
                    key={g.module.id}
                    storageKey={`admin-chapter:${c.slug}:${g.module.id}`}
                    className="group rounded-[var(--radius-card)] border border-ink/10 bg-paper shadow-[var(--shadow-soft)] overflow-hidden"
                    summary={
                      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center gap-3 px-4 py-3.5 hover:bg-paper-2 transition-colors">
                        <span className="text-ink/40 transition-transform group-open:rotate-90 shrink-0">
                          ▸
                        </span>
                        <span className="eyebrow shrink-0">
                          Chương {from + gi + 1}
                        </span>
                        <span className="font-medium flex-1 min-w-0 truncate">
                          {g.module.title}
                        </span>
                        <span className="font-mono text-xs text-ink/40 tnum shrink-0">
                          {g.lessons.length} bài
                        </span>
                      </summary>
                    }
                  >
                    <div className="px-4 pb-4 pt-1 border-t border-ink/10">
                      {g.lessons.length === 0 ? (
                        <p className="text-sm text-ink/50 py-2">
                          Chưa có bài trong chương này.
                        </p>
                      ) : (
                        <ol className="space-y-2">
                          {g.lessons.map((l, i) => lessonRow(l, i))}
                        </ol>
                      )}
                    </div>
                  </Chapter>
                ))}

                <Pagination
                  basePath={`/admin/khoa-hoc/${c.slug}`}
                  page={page}
                  totalPages={totalPages}
                />
              </>
            )}
          </div>

          {/* Thêm bài */}
          <Card className="p-5">
            <h3 className="font-serif text-lg mb-3">Thêm bài học</h3>
            <form action={createLesson} className="flex flex-col sm:flex-row gap-2">
              <input type="hidden" name="course_id" value={c.id} />
              <input type="hidden" name="course_slug" value={c.slug} />
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
              <input type="hidden" name="slug" value={c.slug} />
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
                  {categories.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.emoji} {cat.label}
                    </option>
                  ))}
                  {/* Loại cũ đã bị xóa khỏi danh sách vẫn giữ được giá trị hiện tại */}
                  {!categories.some((cat) => cat.slug === c.category) && (
                    <option value={c.category}>{c.category}</option>
                  )}
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
              <ul className="text-sm space-y-2 mb-3">
                {mods.map((m, i) => (
                  <li
                    key={m.id}
                    className="rounded-lg border border-ink/10 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-ink/70 truncate">
                        {i + 1}. {m.title}
                      </span>
                      <Link
                        href={`/admin/khoa-hoc/${c.slug}/chuong/${m.id}`}
                        className="link text-xs shrink-0"
                      >
                        Quiz chương →
                      </Link>
                    </div>
                    <details className="group mt-1">
                      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer text-xs text-ink/50 hover:text-ink">
                        Sửa / Xóa chương
                      </summary>
                      <div className="mt-2 flex flex-col gap-2">
                        <form action={updateModule} className="flex gap-2">
                          <input type="hidden" name="id" value={m.id} />
                          <input
                            type="hidden"
                            name="course_slug"
                            value={c.slug}
                          />
                          <input
                            name="title"
                            required
                            defaultValue={m.title}
                            className={inputCls}
                          />
                          <button className={buttonClass("outline", "shrink-0")}>
                            Lưu
                          </button>
                        </form>
                        <form action={deleteModule}>
                          <input type="hidden" name="id" value={m.id} />
                          <input
                            type="hidden"
                            name="course_slug"
                            value={c.slug}
                          />
                          <button className="text-xs text-clay hover:underline">
                            Xóa chương (bài học sẽ chuyển về “Chưa xếp chương”)
                          </button>
                        </form>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            <form action={createModule} className="flex gap-2">
              <input type="hidden" name="course_id" value={c.id} />
              <input type="hidden" name="course_slug" value={c.slug} />
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
