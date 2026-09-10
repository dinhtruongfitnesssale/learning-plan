"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getNavItems, isNavActive, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/cn";

// Thanh điều hướng dưới đáy — chỉ hiện trên điện thoại (dưới 768px), nơi
// ngón cái với tới được. Các mục còn lại nằm trong tab "Thêm".
export function BottomNav({
  variant = "learner",
  isCoach = false,
  pendingCount = 0,
}: {
  variant?: "learner" | "coach";
  isCoach?: boolean;
  pendingCount?: number;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Đóng bảng "Thêm" khi chuyển trang.
  useEffect(() => setMoreOpen(false), [pathname]);

  // Khóa cuộn nền khi bảng "Thêm" đang mở.
  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  const items = getNavItems({ variant, isCoach, pendingCount });
  const tabs = items.filter((it) => it.primary).slice(0, 4);
  const rest = items.filter((it) => !tabs.includes(it));
  const restBadge = rest.reduce((n, it) => n + (it.badge ?? 0), 0);

  return (
    <>
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-ink/45 pop-overlay"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="sheet-up absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-ink/10 bg-paper p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(20,17,14,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-ink/15" />
            {rest.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors",
                  isNavActive(pathname, it.href)
                    ? "bg-amber-soft text-ink font-medium"
                    : "text-ink/80 hover:bg-paper-2",
                )}
              >
                <span className="text-lg leading-none">{it.icon}</span>
                <span className="flex-1">{it.label}</span>
                {it.badge ? <Count n={it.badge} /> : null}
              </Link>
            ))}
            <div className="my-1 border-t border-ink/10" />
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-ink/70 hover:bg-paper-2 transition-colors"
              >
                <span className="text-lg leading-none">🚪</span>
                <span>Thoát</span>
              </button>
            </form>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {tabs.map((it) => (
            <Tab
              key={it.href}
              item={it}
              active={isNavActive(pathname, it.href)}
            />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="Thêm mục khác"
            aria-expanded={moreOpen}
            className="relative flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 h-14 text-ink/55 transition-colors"
          >
            <span className="relative text-lg leading-none">
              ⋯
              {restBadge > 0 && !moreOpen && (
                <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-clay" />
              )}
            </span>
            <span className="text-[11px] leading-none whitespace-nowrap">
              Thêm
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 h-14 transition-colors",
        active ? "text-ink" : "text-ink/55",
      )}
    >
      <span className="relative text-lg leading-none">
        {item.icon}
        {item.badge ? (
          <span className="absolute -top-1.5 -right-2.5">
            <Count n={item.badge} />
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "text-[11px] leading-none whitespace-nowrap",
          active && "font-semibold",
        )}
      >
        {item.short ?? item.label}
      </span>
      {active && (
        <span className="absolute top-0 h-0.5 w-8 rounded-full bg-amber" />
      )}
    </Link>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-clay text-paper text-[10px] font-semibold tabular-nums">
      {n > 99 ? "99+" : n}
    </span>
  );
}
