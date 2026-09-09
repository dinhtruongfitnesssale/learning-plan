import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui";

export const LOCK_HINT = "Hãy liên hệ admin để được mở khóa học";

// Nút "khóa" cho tài khoản khách mời: không bấm được, rê chuột (hoặc
// chạm trên điện thoại) thì hiện lời nhắc liên hệ admin.
export function LockedCourseButton({
  className,
  label = "Đang khóa",
  full = true,
}: {
  className?: string;
  label?: string;
  full?: boolean;
}) {
  return (
    <div className={cn("relative group", full && "w-full", className)}>
      <span
        tabIndex={0}
        role="note"
        aria-label={`${label} — ${LOCK_HINT}`}
        className={cn(
          buttonClass("outline", full ? "w-full" : undefined),
          "cursor-not-allowed select-none text-ink/50 outline-none",
        )}
      >
        🔒 {label}
      </span>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[15rem]",
          "-translate-x-1/2 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-paper",
          "opacity-0 shadow-[var(--shadow-soft)] transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        {LOCK_HINT}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink" />
      </span>
    </div>
  );
}
