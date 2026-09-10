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
    <form
      action={basePath}
      method="get"
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <input
        name="q"
        defaultValue={q}
        placeholder="Tìm khóa học…"
        className={`${inputCls} w-full sm:flex-1 sm:w-auto sm:min-w-[160px]`}
      />
      <div className="flex items-center gap-2 sm:contents">
        {/* w-full + min-w-0: tên loại dài mấy cũng không kéo giãn ô chọn */}
        <select
          name="cat"
          defaultValue={cat}
          className={`${inputCls} w-full min-w-0 flex-1 sm:w-44 sm:flex-none`}
        >
          <option value="">Tất cả loại</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
        <button className={buttonClass("outline", "shrink-0")}>Lọc</button>
      </div>
    </form>
  );
}
