"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { updateCoinPack, toggleCoinPack, deleteCoinPack } from "../actions";
import { Badge, buttonClass } from "@/components/ui";
import { formatVnd } from "@/lib/payment";
import type { CoinPack } from "@/lib/supabase/types";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";
const smallBtn = "!px-3 !py-1.5 text-xs";

// Một dòng gói nạp: xem / sửa tại chỗ / ẩn-hiện / xóa.
export function CoinPackRow({ pack: p }: { pack: CoinPack }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateCoinPack, null);
  const [confirmDel, setConfirmDel] = useState(false);
  // Ẩn / xóa: báo đang chạy, xóa xong ẩn dòng ngay, lỗi thì hiện ra.
  const [busy, startBusy] = useTransition();
  const [busyWhat, setBusyWhat] = useState<"toggle" | "delete" | null>(null);
  const [gone, setGone] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  function run(what: "toggle" | "delete", fn: (fd: FormData) => Promise<{ ok: boolean; message: string }>) {
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

  // Lưu xong thì đóng form.
  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  const total = p.coins + p.bonus;
  if (gone) return null;

  return (
    <div className={`px-4 py-3 ${p.active ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">
            {p.name} {!p.active && <Badge>Đang ẩn</Badge>}
          </div>
          <div className="text-xs text-ink/55 font-mono tnum">
            {formatVnd(p.price)} → {p.coins}
            {p.bonus > 0 && ` + ${p.bonus} tặng`} xu ·{" "}
            {Math.round(p.price / total).toLocaleString("vi-VN")}đ/xu
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
            onClick={() => run("toggle", toggleCoinPack)}
            className={buttonClass("ghost", smallBtn)}
          >
            {busy && busyWhat === "toggle" ? "Đang lưu…" : p.active ? "Ẩn" : "Hiện"}
          </button>
          {confirmDel ? (
            <div className="flex gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => run("delete", deleteCoinPack)}
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
        <form
          action={action}
          className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end rounded-lg bg-paper-2 p-3"
        >
          <input type="hidden" name="id" value={p.id} />
          <label className="block col-span-2 min-w-0">
            <span className="text-xs text-ink/70">Tên gói</span>
            <input name="name" required defaultValue={p.name} className={inputCls} />
          </label>
          <label className="block min-w-0">
            <span className="text-xs text-ink/70">Giá (VND)</span>
            <input
              name="price"
              type="number"
              min={1000}
              step={1000}
              required
              defaultValue={p.price}
              className={inputCls}
            />
          </label>
          <label className="block min-w-0">
            <span className="text-xs text-ink/70">Xu</span>
            <input
              name="coins"
              type="number"
              min={1}
              required
              defaultValue={p.coins}
              className={inputCls}
            />
          </label>
          <label className="block min-w-0">
            <span className="text-xs text-ink/70">Tặng thêm</span>
            <input
              name="bonus"
              type="number"
              min={0}
              defaultValue={p.bonus}
              className={inputCls}
            />
          </label>
          <label className="block min-w-0">
            <span className="text-xs text-ink/70">Thứ tự hiện</span>
            <input
              name="sort_order"
              type="number"
              min={0}
              defaultValue={p.sort_order}
              className={inputCls}
            />
          </label>
          <div className="col-span-2 sm:col-span-4 flex flex-wrap items-center gap-3">
            <button disabled={pending} className={buttonClass("primary", "!py-2")}>
              {pending ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
            {state && !state.ok && (
              <span className="text-sm text-clay">{state.message}</span>
            )}
            <span className="text-xs text-ink/45">
              Đơn nạp đang chờ chuyển khoản giữ giá & số xu cũ.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
