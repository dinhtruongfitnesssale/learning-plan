"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { savePromo } from "../actions/promos";
import { buttonClass } from "@/components/ui";
import { formatVnd } from "@/lib/payment";
import type { Course, PromoCode } from "@/lib/supabase/types";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

// timestamptz → giá trị ô datetime-local theo giờ Việt Nam.
function toVnLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

export type PromoCourse = Pick<Course, "id" | "title" | "cover_emoji" | "price">;

// Form tạo mã mới (không truyền promo) hoặc sửa mã có sẵn.
export function PromoForm({
  promo,
  courseIds = [],
  courses,
  onSaved,
}: {
  promo?: PromoCode;
  courseIds?: string[];
  courses: PromoCourse[];
  onSaved?: () => void;
}) {
  const [state, action, pending] = useActionState(savePromo, null);
  const [type, setType] = useState(promo?.discount_type ?? "percent");
  const [scope, setScope] = useState(promo && !promo.all_courses ? "selected" : "all");
  const formRef = useRef<HTMLFormElement>(null);

  // Lưu xong: form tạo mới thì xóa trắng, form sửa thì đóng lại.
  useEffect(() => {
    if (!state?.ok) return;
    if (!promo) {
      formRef.current?.reset();
      setType("percent");
      setScope("all");
    }
    onSaved?.();
  }, [state, promo, onSaved]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {promo && <input type="hidden" name="id" value={promo.id} />}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <label className="block col-span-2 min-w-0">
          <span className="text-sm text-ink/70">Mã</span>
          <input
            name="code"
            required
            defaultValue={promo?.code}
            placeholder="KHAITRUONG"
            autoCapitalize="characters"
            className={`${inputCls} font-mono uppercase`}
          />
        </label>
        <label className="block col-span-2 min-w-0">
          <span className="text-sm text-ink/70">Ghi chú (chỉ admin thấy)</span>
          <input
            name="label"
            defaultValue={promo?.label}
            placeholder="Tặng nhóm Zalo tháng 11"
            className={inputCls}
          />
        </label>
        <label className="block min-w-0">
          <span className="text-sm text-ink/70">Kiểu giảm</span>
          <select
            name="discount_type"
            value={type}
            onChange={(e) => setType(e.target.value as "percent" | "amount")}
            className={inputCls}
          >
            <option value="percent">Theo %</option>
            <option value="amount">Theo số tiền</option>
          </select>
        </label>
        <label className="block min-w-0">
          <span className="text-sm text-ink/70">
            {type === "percent" ? "Giảm (%)" : "Giảm (VND)"}
          </span>
          <input
            name="discount_value"
            type="number"
            required
            min={type === "percent" ? 1 : 1000}
            max={type === "percent" ? 100 : undefined}
            step={type === "percent" ? 1 : 1000}
            defaultValue={promo?.discount_value}
            className={inputCls}
          />
        </label>
        <label className="block min-w-0">
          <span className="text-sm text-ink/70">Tổng lượt</span>
          <input
            name="max_uses"
            type="number"
            min={1}
            defaultValue={promo?.max_uses ?? ""}
            placeholder="Không giới hạn"
            className={inputCls}
          />
        </label>
        <label className="block min-w-0">
          <span className="text-sm text-ink/70">Ngày hết hạn</span>
          <input
            name="ends_at"
            type="datetime-local"
            defaultValue={toVnLocalInput(promo?.ends_at ?? null)}
            className={inputCls}
          />
        </label>
      </div>

      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="stackable"
            defaultChecked={promo?.stackable ?? false}
            className="mt-1"
          />
          <span>
            <b>Cộng dồn với mã khác</b>
            <span className="block text-xs text-ink/50">
              Học viên chỉ dùng nhiều mã cùng lúc khi tất cả các mã đều bật ô
              này. Nhiều mã % thì giảm nối tiếp (20% rồi 10% = giảm 28%).
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="with_course_discount"
            defaultChecked={promo?.with_course_discount ?? true}
            className="mt-1"
          />
          <span>
            <b>Dùng chung với ưu đãi của khóa</b>
            <span className="block text-xs text-ink/50">
              Bật: giảm tiếp trên giá đã ưu đãi. Tắt: tính trên giá gốc, học
              viên được mức có lợi hơn giữa ưu đãi khóa và mã.
            </span>
          </span>
        </label>
      </div>

      <fieldset className="space-y-2 text-sm">
        <legend className="text-sm text-ink/70 mb-1">Áp dụng cho</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="scope"
              value="all"
              checked={scope === "all"}
              onChange={() => setScope("all")}
            />
            Tất cả khóa có học phí
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="scope"
              value="selected"
              checked={scope === "selected"}
              onChange={() => setScope("selected")}
            />
            Chọn khóa
          </label>
        </div>
        {scope === "selected" &&
          (courses.length === 0 ? (
            <p className="text-xs text-ink/50">Chưa có khóa nào đặt học phí.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-1.5 rounded-lg bg-paper-2 p-3">
              {courses.map((c) => (
                <label key={c.id} className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    name="course_ids"
                    value={c.id}
                    defaultChecked={courseIds.includes(c.id)}
                  />
                  <span className="truncate">
                    {c.cover_emoji} {c.title}
                  </span>
                  <span className="text-xs text-ink/45 font-mono tnum shrink-0">
                    {formatVnd(c.price)}
                  </span>
                </label>
              ))}
            </div>
          ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={buttonClass("primary")}>
          {pending ? "Đang lưu…" : promo ? "Lưu thay đổi" : "Tạo mã"}
        </button>
        {state && (
          <span className={`text-sm ${state.ok ? "text-herb" : "text-clay"}`}>
            {state.message}
          </span>
        )}
        {promo && (
          <span className="text-xs text-ink/45">
            Đơn đã áp mã từ trước giữ điều kiện cũ.
          </span>
        )}
      </div>
    </form>
  );
}
