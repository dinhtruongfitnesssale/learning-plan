import Link from "next/link";
import Image from "next/image";
import { APP_NAME } from "@/lib/brand";
import type { Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/cn";

export function AppHeader({
  profile,
  variant = "learner",
}: {
  profile: Profile | null;
  variant?: "learner" | "coach";
}) {
  const isCoach = profile?.role === "coach";
  const home = variant === "coach" ? "/admin" : "/hoc";

  return (
    <header className="border-b border-ink/10 bg-paper/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-5xl px-5 h-14 flex items-center justify-between">
        <Link href={home} className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={28} height={28} />
          <span className="font-serif text-lg leading-none">{APP_NAME}</span>
          {variant === "coach" && (
            <span className="eyebrow ml-1 hidden sm:inline">Quản trị</span>
          )}
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
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
