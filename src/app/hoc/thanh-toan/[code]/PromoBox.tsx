"use client";

import { useActionState, useEffect, useRef } from "react";
import { applyPromo, removePromo } from "../actions";
import { buttonClass } from "@/components/ui";
import { promoBadge } from "@/lib/promo";
import type { PaymentPromo } from "@/lib/supabase/types";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

// Ô nhập mã khuyến mãi trên trang thanh toán học phí (chỉ khi đơn đang chờ).
export function PromoBox({
  paymentCode,
  amount,
  promos,
}: {
  paymentCode: string;
  amount: number;
  promos: PaymentPromo[];
}) {
  const [state, action, pending] = useActionState(applyPromo, null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Áp được thì xóa ô nhập cho gõ mã tiếp.
  useEffect(() => {
    if (state?.ok && inputRef.current) inputRef.current.value = "";
  }, [state]);

  return (
    <div className="space-y-3">
      <p className="font-medium text-ink text-sm">🏷️ Mã khuyến mãi</p>

      {promos.length > 0 && (
        <ul className="space-y-1.5">
          {promos.map((p) => (
            <li
              key={p.code}
              className="flex items-center justify-between gap-3 rounded-lg bg-herb-soft/60 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="font-mono font-semibold">{p.code}</span>{" "}
                <span className="text-herb">{promoBadge(p)}</span>
              </span>
              <form action={removePromo}>
                <input type="hidden" name="payment_code" value={paymentCode} />
                <input type="hidden" name="code" value={p.code} />
                <button className="text-xs link shrink-0">Bỏ mã</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="flex gap-2">
        <input type="hidden" name="payment_code" value={paymentCode} />
        <input type="hidden" name="amount" value={amount} />
        <input
          ref={inputRef}
          name="code"
          placeholder="Nhập mã"
          autoCapitalize="characters"
          autoComplete="off"
          className={`${inputCls} font-mono uppercase`}
        />
        <button disabled={pending} className={buttonClass("outline", "!py-2 shrink-0")}>
          {pending ? "Đang áp…" : "Áp dụng"}
        </button>
      </form>

      {state && (
        <p role="status" className={`text-sm ${state.ok ? "text-herb" : "text-clay"}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}
