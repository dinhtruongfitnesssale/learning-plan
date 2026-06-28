import Link from "next/link";
import Image from "next/image";
import { APP_NAME } from "@/lib/brand";
import type { Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/cn";

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

  return (
    <header className="border-b border-ink/10 bg-paper/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-5xl px-5 h-14 flex items-center justify-between gap-6">
        <Link href={home} className="flex items-center gap-2.5 min-w-0 shrink">
          <Image src="/logo.png" alt="" width={28} height={28} className="shrink-0" />
          <span className="font-serif text-lg leading-none truncate">{APP_NAME}</span>
          {variant === "coach" && (
            <span className="eyebrow ml-1 hidden sm:inline shrink-0">Quản trị</span>
          )}
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
          {variant === "learner" ? (
            <>
              <NavLink href="/hoc">Bảng học</NavLink>
              <NavLink href="/hoc/khoa-hoc">Khóa học</NavLink>
              {isCoach && <NavLink href="/admin">Quản trị</NavLink>}
            </>
          ) : (
            <>
              <NavLink href="/admin">Tổng quan</NavLink>
              <NavLink href="/admin/khoa-hoc">Khóa học</NavLink>
              <NavLink href="/admin/hoc-vien">Học viên</NavLink>
              <Link
                href="/admin/yeu-cau"
                className="relative rounded-full px-3 py-1.5 text-sm text-ink/70 hover:bg-paper-2 hover:text-ink transition-colors"
              >
                Yêu cầu
                {pendingCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-clay text-paper text-xs font-semibold tabular-nums align-middle">
                    {pendingCount}
                  </span>
                )}
              </Link>
              <NavLink href="/hoc">Xem như học viên</NavLink>
            </>
          )}
          <form action="/auth/signout" method="post" className="ml-1">
            <button
              type="submit"
              className="rounded-full px-3 py-1.5 text-sm text-ink/60 hover:bg-paper-2 hover:text-ink transition-colors"
            >
              Thoát
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm text-ink/70 hover:bg-paper-2 hover:text-ink transition-colors",
      )}
    >
      {children}
    </Link>
  );
}
