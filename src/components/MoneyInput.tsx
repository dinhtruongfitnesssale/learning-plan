"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

// "99000" → "99.000". Chuỗi rỗng giữ rỗng.
function group(digits: string) {
  const d = digits.replace(/^0+(?=\d)/, "");
  return d ? Number(d).toLocaleString("vi-VN") : "";
}

// Ô nhập tiền: gõ tới đâu tự chèn dấu chấm hàng nghìn tới đó, có đơn vị ở
// cuối ô. Form gửi lên chuỗi có dấu chấm ("99.000") — server bỏ ký tự
// không phải số trước khi đọc (xem nonNeg ở admin/actions/_shared.ts).
//
// Cố ý KHÔNG dùng state của React: nghe sự kiện input gốc trên chính ô, để
// code ngoài điền giá trị rồi bắn event "input" (vd. PricingPresets) cũng
// được định dạng như lúc gõ tay.
export function MoneyInput({
  name,
  defaultValue,
  unit = "đ",
  className,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "type"> & {
  name: string;
  defaultValue?: number | null;
  unit?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onInput = () => {
      const caret = el.selectionStart ?? el.value.length;
      // Giữ con trỏ đứng sau đúng số chữ số như trước khi định dạng lại.
      const digitsBefore = el.value.slice(0, caret).replace(/\D/g, "").length;
      const next = group(el.value.replace(/\D/g, ""));
      if (next === el.value) return;
      el.value = next;
      let pos = 0;
      for (let seen = 0; pos < next.length && seen < digitsBefore; pos++) {
        if (/\d/.test(next[pos])) seen++;
      }
      if (document.activeElement === el) el.setSelectionRange(pos, pos);
    };
    el.addEventListener("input", onInput);
    return () => el.removeEventListener("input", onInput);
  }, []);

  return (
    <div className="relative">
      <input
        ref={ref}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={defaultValue != null ? group(String(defaultValue)) : ""}
        className={cn(className, "pr-8 font-mono tnum")}
        {...rest}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink/45">
        {unit}
      </span>
    </div>
  );
}
