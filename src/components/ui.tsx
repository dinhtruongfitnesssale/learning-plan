import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Accent } from "@/lib/supabase/types";

// ── Eyebrow: nhãn amber chữ hoa nhỏ ───────────────────────────
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("eyebrow", className)}>{children}</p>;
}

// ── Rule line editorial ───────────────────────────────────────
export function Rule({ amber = false, className }: { amber?: boolean; className?: string }) {
  return <hr className={cn(amber ? "rule-amber" : "rule", className)} />;
}

// ── Card paper ────────────────────────────────────────────────
export function Card({
  children,
  className,
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <As
      className={cn(
        "rounded-[var(--radius-card)] border border-ink/10 bg-paper",
        "shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      {children}
    </As>
  );
}

// ── Button ────────────────────────────────────────────────────
type ButtonVariant = "primary" | "ghost" | "outline" | "danger";
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/90",
  ghost: "text-ink hover:bg-paper-2",
  outline: "border border-ink/20 text-ink hover:border-ink/40 hover:bg-paper-2",
  danger: "bg-clay text-paper hover:bg-clay/90",
};

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cn(buttonBase, buttonVariants[variant], className);
}

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

// ── Badge accent ──────────────────────────────────────────────
const accentMap: Record<Accent | "ink", { bg: string; text: string }> = {
  amber: { bg: "bg-amber-soft", text: "text-amber" },
  herb: { bg: "bg-herb-soft", text: "text-herb" },
  slate: { bg: "bg-slate-soft", text: "text-slate" },
  clay: { bg: "bg-clay-soft", text: "text-clay" },
  ink: { bg: "bg-paper-2", text: "text-ink/70" },
};

export function Badge({
  children,
  accent = "ink",
  className,
}: {
  children: React.ReactNode;
  accent?: Accent | "ink";
  className?: string;
}) {
  const c = accentMap[accent];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        c.bg,
        c.text,
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Stat: số liệu mono ────────────────────────────────────────
export function Stat({
  value,
  label,
  accent = "ink",
}: {
  value: React.ReactNode;
  label: string;
  accent?: Accent | "ink";
}) {
  const textColor =
    accent === "ink" ? "text-ink" : accentMap[accent].text;
  return (
    <div>
      <div className={cn("font-mono text-2xl font-semibold tnum", textColor)}>
        {value}
      </div>
      <div className="text-xs text-ink/50 mt-0.5">{label}</div>
    </div>
  );
}
