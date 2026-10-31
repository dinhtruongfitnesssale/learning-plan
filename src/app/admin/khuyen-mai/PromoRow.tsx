"use client";

import { useCallback, useState, useTransition } from "react";
import { togglePromo, deletePromo } from "../actions/promos";
import { Badge, buttonClass } from "@/components/ui";
import { promoBadge } from "@/lib/promo";
import type { PromoCode } from "@/lib/supabase/types";
import { PromoForm, type PromoCourse } from "./PromoForm";

const smallBtn = "!px-3 !py-1.5 text-xs";

function endsText(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Một dòng mã: xem / sửa tại chỗ / ẩn-hiện / xóa.
export function PromoRow({
  promo: p,
  courseIds,
  uses,
  courses,
}: {
  promo: PromoCode;
  courseIds: string[];
  uses: number;
  courses: PromoCourse[];
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  // Ẩn / xóa: báo đang chạy, xóa xong ẩn dòng ngay, lỗi thì hiện ra.
  const [busy, startBusy] = useTransition();
  const [busyWhat, setBusyWhat] = useState<"toggle" | "delete" | null>(null);
  const [gone, setGone] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const close = useCallback(() => setEditing(false), []);

  function run(
    what: "toggle" | "delete",
    fn: (fd: FormData) => Promise<{ ok: boolean; message: string }>,
  ) {
    const fd = new FormData();
    fd.set("id", p.id);
    fd.set("active", String(p.active));
    setBusyWhat(what);
    setRowError(null);
    startBusy(async () => {
      const r = await fn(fd);
      if (!r.ok) setRowError(r.message || "Không thực hiện được, thử lại nhé.");
      else if (what === "delete") setGone(true);
    });
  }

  if (gone) return null;

  const expired = !!p.ends_at && new Date(p.ends_at).getTime() <= Date.now();
  const soldOut = p.max_uses != null && uses >= p.max_uses;
  const scopeText = p.all_courses
    ? "Tất cả khóa"
    : courses
        .filter((c) => courseIds.includes(c.id))
        .map((c) => `${c.cover_emoji} ${c.title}`)
        .join(", ") || "Chưa chọn khóa";

  return (
    <div className={`px-4 py-3 ${p.active && !expired && !soldOut ? "" : "opacity-60"}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono font-semibold">{p.code}</span>
            <Badge accent="herb">{promoBadge(p)}</Badge>
            {!p.active && <Badge>Đang ẩn</Badge>}
            {expired && <Badge accent="clay">Hết hạn</Badge>}
            {soldOut && <Badge accent="clay">Hết lượt</Badge>}
          </div>
          {p.label && <div className="text-sm text-ink/70">{p.label}</div>}
          <div className="text-xs text-ink/55 space-y-0.5">
            <div>
              Đã dùng{" "}
              <b className="font-mono tnum text-ink">
                {uses}
                {p.max_uses != null && `/${p.max_uses}`}
              </b>{" "}
              lượt
              {p.ends_at && ` · hết hạn ${endsText(p.ends_at)}`}
            </div>
            <div>
              {p.stackable ? "Cộng dồn với mã khác" : "Không cộng dồn"} ·{" "}
              {p.with_course_discount
                ? "giảm tiếp trên ưu đãi khóa"
                : "tính trên giá gốc"}
            </div>
            <div className="line-clamp-2">{scopeText}</div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={buttonClass(editing ? "outline" : "ghost", smallBtn)}
          >
            {editing ? "Đóng" : "Sửa"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("toggle", togglePromo)}
            className={buttonClass("ghost", smallBtn)}
          >
            {busy && busyWhat === "toggle" ? "Đang lưu…" : p.active ? "Ẩn" : "Hiện"}
          </button>
          {confirmDel ? (
            <div className="flex gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => run("delete", deletePromo)}
                className={buttonClass("danger", smallBtn)}
              >
                {busy && busyWhat === "delete" ? "Đang xóa…" : "Xóa hẳn"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDel(false)}
                className={buttonClass("ghost", smallBtn)}
              >
                Thôi
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className={buttonClass("ghost", `${smallBtn} text-clay`)}
            >
              Xóa
            </button>
          )}
        </div>
      </div>

      {rowError && (
        <p role="alert" className="mt-2 text-sm text-clay">
          ⚠ {rowError}
        </p>
      )}

      {editing && (
        <div className="mt-3 rounded-lg bg-paper-2 p-3">
          <PromoForm promo={p} courseIds={courseIds} courses={courses} onSaved={close} />
        </div>
      )}
    </div>
  );
}
