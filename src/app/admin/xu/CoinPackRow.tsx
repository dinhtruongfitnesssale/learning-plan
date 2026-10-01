"use client";

import { useActionState, useEffect, useState } from "react";
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

  // Lưu xong thì đóng form.
  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  const total = p.coins + p.bonus;

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
          <form action={toggleCoinPack}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="active" value={String(p.active)} />
            <button className={buttonClass("ghost", smallBtn)}>
              {p.active ? "Ẩn" : "Hiện"}
            </button>
          </form>
          {confirmDel ? (
            <form action={deleteCoinPack} className="flex gap-1">
              <input type="hidden" name="id" value={p.id} />
              <button className={buttonClass("danger", smallBtn)}>Xóa hẳn</button>
              <button
                type="button"
                onClick={() => setConfirmDel(false)}
                className={buttonClass("ghost", smallBtn)}
              >
                Thôi
              </button>
            </form>
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
