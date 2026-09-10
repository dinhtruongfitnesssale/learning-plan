import Link from "next/link";
import { cn } from "@/lib/cn";

// Phân trang bằng link, giữ nguyên các tham số lọc hiện tại.
// Luôn gói gọn trong MỘT dòng: nhiều trang thì chỉ hiện trang đầu, trang
// cuối và quanh trang hiện tại; phần bị lược bớt thu thành dấu "…" — bấm
// vào đó là nhảy tiếp vào giữa khoảng đang ẩn (nút xem thêm).
export function Pagination({
  basePath,
  page,
  totalPages,
  params = {},
  pageParam = "page",
}: {
  basePath: string;
  page: number;
  totalPages: number;
  params?: Record<string, string>;
  // Tên tham số trang trên URL (đổi khi có nhiều danh sách phân trang cùng trang).
  pageParam?: string;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    if (p > 1) sp.set(pageParam, String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const cur = Math.min(Math.max(1, page), totalPages);

  const row = (neighbors: number) =>
    buildSlots(cur, totalPages, neighbors).map((slot, i) =>
      typeof slot === "number" ? (
        <Link
          key={slot}
          href={href(slot)}
          aria-current={slot === cur ? "page" : undefined}
          className={chipCls(slot === cur)}
        >
          {slot}
        </Link>
      ) : (
        <Link
          key={`gap-${i}`}
          href={href(slot.to)}
          title={`Xem thêm trang (tới trang ${slot.to})`}
          aria-label={`Xem thêm trang — tới trang ${slot.to}`}
          className={cn(chipCls(false), "px-1 text-ink/45")}
        >
          …
        </Link>
      ),
    );

  return (
    <nav className="flex items-center justify-center gap-1 sm:gap-1.5 pt-2">
      {cur > 1 && (
        <Link href={href(cur - 1)} aria-label="Trang trước" className={chipCls(false)}>
          ←
        </Link>
      )}
      {/* Điện thoại: cửa sổ hẹp (chỉ trang hiện tại) — máy rộng: kèm 2 trang kề */}
      <div className="flex items-center gap-1 sm:hidden">{row(0)}</div>
      <div className="hidden sm:flex items-center gap-1.5">{row(1)}</div>
      {cur < totalPages && (
        <Link href={href(cur + 1)} aria-label="Trang sau" className={chipCls(false)}>
          →
        </Link>
      )}
    </nav>
  );
}

// Danh sách ô cần hiện: số trang, hoặc khoảng bị lược ({ to } = trang sẽ
// nhảy tới khi bấm "…", lấy giữa khoảng cho đỡ phải bấm nhiều lần).
function buildSlots(cur: number, total: number, neighbors: number) {
  const keep = new Set<number>([1, total, cur]);
  for (let d = 1; d <= neighbors; d++) {
    keep.add(cur - d);
    keep.add(cur + d);
  }
  const pages = [...keep]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const slots: (number | { to: number })[] = [];
  pages.forEach((p, i) => {
    const prev = pages[i - 1];
    if (prev !== undefined && p - prev > 1) {
      // Đúng một trang bị bỏ qua thì hiện luôn số, không cần "…".
      if (p - prev === 2) slots.push(prev + 1);
      else slots.push({ to: Math.floor((prev + p) / 2) });
    }
    slots.push(p);
  });
  return slots;
}

function chipCls(active: boolean) {
  return cn(
    "min-w-9 h-9 px-2 sm:px-3 grid place-items-center rounded-lg text-xs sm:text-sm font-mono tabular-nums transition-colors shrink-0",
    active
      ? "bg-ink text-paper"
      : "border border-ink/15 text-ink/70 hover:border-ink/35 hover:bg-paper-2",
  );
}
