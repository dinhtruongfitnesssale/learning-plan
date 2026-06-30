import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getAdminCourses, getCategories } from "@/lib/data";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import { CourseFilter } from "@/components/CourseFilter";
import { Pagination } from "@/components/Pagination";
import { createCourse, createCategory, deleteCategory } from "../actions";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

export default async function AdminCourses({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; page?: string }>;
}) {
  await requireCoach();
  const sp = await searchParams;
  const q = sp.q ?? "";
  const cat = sp.cat ?? "";
  const page = Number(sp.page) || 1;
  const [{ items, page: cur, totalPages }, categories] = await Promise.all([
    getAdminCourses({ q, cat, page }),
    getCategories(),
  ]);
  const catMap = new Map(categories.map((c) => [c.slug, c]));

  return (
    <div className="space-y-6">
      <section>
        <Eyebrow>Quản trị · Khóa học</Eyebrow>
        <h1 className="font-serif text-3xl mt-2">Khóa học</h1>
      </section>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Danh sách */}
        <div className="space-y-4">
          <CourseFilter
            basePath="/admin/khoa-hoc"
            q={q}
            cat={cat}
            categories={categories}
          />

          <div className="space-y-3">
            {items.length === 0 && (
              <Card className="p-6 text-ink/60">
                Không có khóa nào khớp bộ lọc.
              </Card>
            )}
            {items.map((c) => {
              const ct = catMap.get(c.category);
              return (
                <Link key={c.id} href={`/admin/khoa-hoc/${c.slug}`}>
                  <Card className="p-4 flex items-center gap-4 hover:border-ink/25 transition-colors">
                    <span className="text-2xl">{c.cover_emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-ink/50 font-mono">/{c.slug}</div>
                    </div>
                    <Badge accent={ct?.accent ?? "amber"}>
                      {ct?.label ?? c.category}
                    </Badge>
                    <Badge accent={c.published ? "herb" : "ink"}>
                      {c.published ? "Đã xuất bản" : "Nháp"}
                    </Badge>
                  </Card>
                </Link>
              );
            })}
          </div>

          <Pagination
            basePath="/admin/khoa-hoc"
            page={cur}
            totalPages={totalPages}
            params={{ q, cat }}
          />
        </div>

        {/* Cột phải */}
        <div className="space-y-5">
          {/* Tạo khóa */}
          <Card className="p-6" as="section">
            <h2 className="font-serif text-xl mb-4">Tạo khóa mới</h2>
            <form action={createCourse} className="space-y-3">
              <label className="block">
                <span className="text-sm text-ink/70">Tên khóa</span>
                <input
                  name="title"
                  required
                  className={inputCls}
                  placeholder="VD: Dinh dưỡng nền tảng"
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink/70">Mô tả ngắn</span>
                <textarea name="summary" rows={2} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-sm text-ink/70">Loại khóa</span>
                <select
                  name="category"
                  className={inputCls}
                  defaultValue={categories[0]?.slug ?? ""}
                >
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-ink/70">Biểu tượng</span>
                  <input name="cover_emoji" defaultValue="🍲" className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-sm text-ink/70">Màu</span>
                  <select name="accent" className={inputCls} defaultValue="amber">
                    <option value="amber">Amber</option>
                    <option value="herb">Herb (xanh rau)</option>
                    <option value="slate">Slate (xanh xám)</option>
                    <option value="clay">Clay (đỏ đất)</option>
                  </select>
                </label>
              </div>
              <button className={buttonClass("primary", "w-full")}>Tạo khóa</button>
            </form>
          </Card>

          {/* Loại khóa học */}
          <Card className="p-6" as="section">
            <h2 className="font-serif text-xl mb-1">Loại khóa học</h2>
            <p className="text-xs text-ink/50 mb-4">
              Thêm loại bất kỳ để gán cho khóa học.
            </p>

            {categories.length > 0 && (
              <ul className="space-y-1.5 mb-4">
                {categories.map((c) => (
                  <li
                    key={c.slug}
                    className="flex items-center gap-2 text-sm rounded-lg border border-ink/10 bg-paper px-3 py-2"
                  >
                    <span className="shrink-0">{c.emoji}</span>
                    <span className="flex-1 min-w-0 truncate">{c.label}</span>
                    <Badge accent={c.accent}>{c.accent}</Badge>
                    <form action={deleteCategory}>
                      <input type="hidden" name="slug" value={c.slug} />
                      <button
                        className="text-xs text-clay hover:underline shrink-0"
                        title="Chỉ xóa được khi không còn khóa nào dùng loại này"
                      >
                        xóa
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            <form action={createCategory} className="space-y-3">
              <label className="block">
                <span className="text-sm text-ink/70">Tên loại mới</span>
                <input
                  name="label"
                  required
                  className={inputCls}
                  placeholder="VD: Yoga, Giảm cân…"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-ink/70">Biểu tượng</span>
                  <input name="emoji" defaultValue="🏷️" className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-sm text-ink/70">Màu</span>
                  <select name="accent" className={inputCls} defaultValue="slate">
                    <option value="amber">Amber</option>
                    <option value="herb">Herb (xanh rau)</option>
                    <option value="slate">Slate (xanh xám)</option>
                    <option value="clay">Clay (đỏ đất)</option>
                  </select>
                </label>
              </div>
              <button className={buttonClass("outline", "w-full")}>
                + Thêm loại
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
