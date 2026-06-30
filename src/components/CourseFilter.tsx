import { buttonClass } from "@/components/ui";

const inputCls =
  "rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

// Bộ lọc khóa học: ô tìm kiếm + loại (danh sách loại truyền vào). Form GET, không cần JS.
export function CourseFilter({
  basePath,
  q,
  cat,
  categories,
}: {
  basePath: string;
  q: string;
  cat: string;
  categories: { slug: string; label: string; emoji: string }[];
}) {
  return (
    <form action={basePath} method="get" className="flex flex-wrap items-center gap-2">
      <input
        name="q"
        defaultValue={q}
        placeholder="Tìm khóa học…"
        className={`${inputCls} flex-1 min-w-[160px]`}
      />
      <select name="cat" defaultValue={cat} className={inputCls}>
        <option value="">Tất cả loại</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.emoji} {c.label}
          </option>
        ))}
      </select>
      <button className={buttonClass("outline")}>Lọc</button>
    </form>
  );
}
