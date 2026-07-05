"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import type { Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; badge?: number };

export function AppHeader({
  profile,
  variant = "learner",
  pendingCount = 0,
}: {
  profile: Profile | null;
  variant?: "learner" | "coach";
  pendingCount?: number;
}) {
  const isCoach = profile?.role === "coach";
  const home = variant === "coach" ? "/admin" : "/hoc";
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi đổi trang.
  useEffect(() => setOpen(false), [pathname]);

  // Đóng menu khi bấm ra ngoài.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const items: NavItem[] =
    variant === "learner"
      ? [
          { href: "/hoc", label: "Bảng học" },
          { href: "/hoc/khoa-hoc", label: "Khóa học" },
          { href: "/hoc/doi-mat-khau", label: "Đổi mật khẩu" },
          ...(isCoach ? [{ href: "/admin", label: "Quản trị" }] : []),
        ]
      : [
          { href: "/admin", label: "Tổng quan" },
          { href: "/admin/khoa-hoc", label: "Khóa học" },
          { href: "/admin/hoc-vien", label: "Học viên" },
          { href: "/admin/gui-mail", label: "Gửi mail" },
          { href: "/admin/theo-doi", label: "Theo dõi" },
          { href: "/admin/danh-gia", label: "Đánh giá" },
          { href: "/admin/yeu-cau", label: "Yêu cầu", badge: pendingCount },
          { href: "/hoc", label: "Xem như học viên" },
        ];

  // Ngưỡng hiện nav ngang: coach nhiều mục + tên app dài nên chỉ mở ở màn
  // hình rất rộng (2xl); dưới mức đó dùng menu ☰ để không đè logo.
  const inlineNavCls = variant === "coach" ? "hidden 2xl:flex" : "hidden md:flex";
  const menuBtnCls = variant === "coach" ? "2xl:hidden" : "md:hidden";

  return (
    <header className="border-b border-ink/10 bg-paper/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-5xl px-5 h-14 flex items-center justify-between gap-4">
        <Link href={home} className="flex items-center gap-2.5 min-w-0 shrink">
          <Image src="/logo.png" alt="" width={28} height={28} className="shrink-0" />
          <span className="font-serif text-lg leading-none truncate">{APP_NAME}</span>
          {variant === "coach" && (
            <span className="eyebrow ml-1 hidden sm:inline shrink-0">Quản trị</span>
          )}
        </Link>

        {/* Nav ngang — chỉ khi đủ rộng */}
        <nav className={cn("items-center gap-1 lg:gap-2 shrink-0", inlineNavCls)}>
          {items.map((it) => (
            <NavLink key={it.href} href={it.href} badge={it.badge}>
              {it.label}
            </NavLink>
          ))}
          <SignOutButton />
        </nav>

        {/* Nút menu thu gọn — khi hẹp */}
        <div className={cn("relative shrink-0", menuBtnCls)} ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Mở menu"
            aria-expanded={open}
            className="relative grid place-items-center w-10 h-10 rounded-full text-ink/70 hover:bg-paper-2 hover:text-ink transition-colors"
          >
            <span className="text-xl leading-none">{open ? "✕" : "☰"}</span>
            {variant === "coach" && pendingCount > 0 && !open && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-clay" />
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-56 rounded-[var(--radius-card)] border border-ink/10 bg-paper shadow-[var(--shadow-soft)] p-1.5 z-40">
              {items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-ink/80 hover:bg-paper-2 hover:text-ink transition-colors"
                >
                  <span>{it.label}</span>
                  {it.badge ? (
                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-clay text-paper text-xs font-semibold tabular-nums">
                      {it.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
              <div className="my-1 border-t border-ink/10" />
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="w-full text-left rounded-lg px-3 py-2 text-sm text-ink/60 hover:bg-paper-2 hover:text-ink transition-colors"
                >
                  Thoát
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
  badge,
}: {
  href: string;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="relative rounded-full px-3 py-1.5 text-sm text-ink/70 hover:bg-paper-2 hover:text-ink transition-colors"
    >
      {children}
      {badge ? (
        <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-clay text-paper text-xs font-semibold tabular-nums align-middle">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function SignOutButton() {
  return (
    <form action="/auth/signout" method="post" className="ml-1">
      <button
        type="submit"
        className="rounded-full px-3 py-1.5 text-sm text-ink/60 hover:bg-paper-2 hover:text-ink transition-colors"
      >
        Thoát
      </button>
    </form>
  );
}
