import Link from "next/link";
import { cn } from "@/lib/cn";

// Phân trang bằng link, giữ nguyên các tham số lọc hiện tại.
export function Pagination({
  basePath,
  page,
  totalPages,
  params = {},
}: {
  basePath: string;
  page: number;
  totalPages: number;
  params?: Record<string, string>;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center gap-1.5 pt-2">
      {page > 1 && (
        <Link href={href(page - 1)} className={linkCls(false)}>
          ←
        </Link>
      )}
      {pages.map((p) => (
        <Link key={p} href={href(p)} className={linkCls(p === page)}>
          {p}
        </Link>
      ))}
      {page < totalPages && (
        <Link href={href(page + 1)} className={linkCls(false)}>
          →
        </Link>
      )}
    </nav>
  );
}

function linkCls(active: boolean) {
  return cn(
    "min-w-9 h-9 px-3 grid place-items-center rounded-lg text-sm font-mono tabular-nums transition-colors",
    active
      ? "bg-ink text-paper"
      : "border border-ink/15 text-ink/70 hover:border-ink/35 hover:bg-paper-2",
  );
}
