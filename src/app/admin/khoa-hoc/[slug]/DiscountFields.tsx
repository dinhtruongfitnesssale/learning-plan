"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/MoneyInput";

// Loại ưu đãi + mức giảm. Giảm số tiền thì ô tự chèn dấu chấm và đơn vị đ;
// giảm % thì là ô số bình thường.
export function DiscountFields({
  type: initialType,
  value,
  inputCls,
}: {
  type: "percent" | "amount" | null;
  value: number;
  inputCls: string;
}) {
  const [type, setType] = useState(initialType ?? "");

  return (
    <>
      <label className="block min-w-0">
        <span className="text-xs text-ink/70">Loại ưu đãi</span>
        <select
          name="discount_type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={inputCls}
        >
          <option value="">Không ưu đãi</option>
          <option value="percent">Giảm theo %</option>
          <option value="amount">Giảm số tiền (VND)</option>
        </select>
      </label>
      <label className="block min-w-0">
        <span className="text-xs text-ink/70">Mức giảm</span>
        {type === "amount" ? (
          <MoneyInput
            key="amount"
            name="discount_value"
            defaultValue={initialType === "amount" ? value : null}
            placeholder="vd 50.000"
            className={inputCls}
          />
        ) : (
          <div className="relative">
            <input
              key="percent"
              name="discount_value"
              type="number"
              min={0}
              max={99}
              defaultValue={initialType === "percent" && value ? value : ""}
              placeholder="vd 20"
              disabled={!type}
              className={`${inputCls} pr-8`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink/45">
              %
            </span>
          </div>
        )}
      </label>
    </>
  );
}
