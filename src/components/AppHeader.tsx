"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import type { Profile } from "@/lib/supabase/types";
import { getNavItems, isInline, isNavActive, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/cn";

export function AppHeader({
  profile,
  variant = "learner",
  pendingCount = 0,
  payCount = 0,
}: {
  profile: Profile | null;
  variant?: "learner" | "coach";
  pendingCount?: number;
  payCount?: number;
}) {
  const isCoach = profile?.role === "coach";
  const home = variant === "coach" ? "/admin" : "/hoc";
  const pathname = usePathname();

  const items = getNavItems({
    variant,
    isCoach,
    pendingCount,
    payCount,
    isGuest: profile?.is_guest ?? false,
  });
  // Thanh ngang chỉ giữ mục dùng hằng ngày; phần còn lại vào "Thêm ▾".
  const inline = items.filter(isInline);
  const rest = items.filter((it) => !isInline(it));

  // Coach nhiều mục hơn nên cần màn hình rộng hơn (lg) mới bày ngang; từ
  // md tới lg dùng nút ☰ chứa tất cả. Dưới md đã có thanh dưới đáy.
  const inlineNavCls = variant === "coach" ? "hidden lg:flex" : "hidden md:flex";
  const burgerCls = variant === "coach" ? "hidden md:block lg:hidden" : "hidden";

  return (
    <header className="border-b border-ink/10 bg-paper/80 backdrop-blur sticky top-0 z-30">
      <div className="safe-x mx-auto max-w-5xl h-14 flex items-center justify-between gap-3">
        <Link href={home} className="flex items-center gap-2.5 min-w-0 shrink">
          <Image src="/logo.png" alt="" width={28} height={28} className="shrink-0" />
          <span className="font-serif text-lg leading-none truncate">{APP_NAME}</span>
          {variant === "coach" && (
            <span className="eyebrow ml-1 hidden sm:inline shrink-0">Quản trị</span>
          )}
        </Link>

        {/* Nav ngang — chỉ khi đủ rộng */}
        <nav className={cn("items-center gap-0.5 shrink-0", inlineNavCls)}>
          {inline.map((it) => (
            <NavLink
              key={it.href}
              item={it}
              active={isNavActive(pathname, it.href)}
            />
          ))}
          <Dropdown
            label={
              <>
                Thêm <span className="text-[10px] opacity-60">▾</span>
              </>
            }
            ariaLabel="Mục khác"
            items={rest}
            pathname={pathname}
            buttonCls="rounded-full px-3 py-1.5 text-sm text-ink/70 hover:bg-paper-2 hover:text-ink"
          />
        </nav>

        {/* Nút ☰ — coach ở khoảng máy tính bảng */}
        <div className={cn("shrink-0", burgerCls)}>
          <Dropdown
            label={<span className="text-xl leading-none">☰</span>}
            ariaLabel="Mở menu"
            items={items}
            pathname={pathname}
            buttonCls="grid place-items-center w-10 h-10 rounded-full text-ink/70 hover:bg-paper-2 hover:text-ink"
          />
        </div>
      </div>
    </header>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
        active
          ? "bg-paper-2 text-ink font-medium"
          : "text-ink/70 hover:bg-paper-2 hover:text-ink",
      )}
    >
      {item.label}
      {item.badge ? <Count n={item.badge} className="ml-1 align-middle" /> : null}
    </Link>
  );
}

// Menu thả xuống dùng chung cho "Thêm ▾" và nút ☰. Luôn kèm nút Thoát ở cuối.
function Dropdown({
  label,
  ariaLabel,
  items,
  pathname,
  buttonCls,
}: {
  label: React.ReactNode;
  ariaLabel: string;
  items: NavItem[];
  pathname: string;
  buttonCls: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const badge = items.reduce((n, it) => n + (it.badge ?? 0), 0);
  const activeInside = items.some((it) => isNavActive(pathname, it.href));

  // Đóng khi đổi trang.
  useEffect(() => setOpen(false), [pathname]);

  // Đóng khi bấm ra ngoài hoặc nhấn Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={cn(
          "relative whitespace-nowrap transition-colors",
          buttonCls,
          activeInside && "bg-paper-2 text-ink font-medium",
        )}
      >
        {label}
        {badge > 0 && !open && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-clay" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(15rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-ink/10 bg-paper shadow-[var(--shadow-soft)] p-1.5 z-40">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isNavActive(pathname, it.href)
                  ? "bg-amber-soft text-ink font-medium"
                  : "text-ink/80 hover:bg-paper-2 hover:text-ink",
              )}
            >
              <span className="text-base leading-none">{it.icon}</span>
              <span className="flex-1">{it.label}</span>
              {it.badge ? <Count n={it.badge} /> : null}
            </Link>
          ))}
          <div className="my-1 border-t border-ink/10" />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-ink/60 hover:bg-paper-2 hover:text-ink transition-colors"
            >
              <span className="text-base leading-none">🚪</span>
              <span>Thoát</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Count({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-clay text-paper text-xs font-semibold tabular-nums",
        className,
      )}
    >
      {n}
    </span>
  );
}
