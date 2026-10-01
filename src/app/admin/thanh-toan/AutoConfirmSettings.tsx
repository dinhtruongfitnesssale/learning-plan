"use client";

import { useActionState } from "react";
import { updatePaymentSettings } from "../actions";
import { buttonClass } from "@/components/ui";
import { formatVnd } from "@/lib/payment";
import type { PaymentSettings } from "@/lib/data";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

// Cài đặt tự chốt — gấp gọn trong 1 dòng, bấm mới mở, để trang Thanh
// toán vẫn chỉ tập trung vào các đơn cần xử lý.
export function AutoConfirmSettings({
  settings: s,
  apiReady,
  webhookReady,
}: {
  settings: PaymentSettings;
  apiReady: boolean;
  webhookReady: boolean;
}) {
  const [state, action, pending] = useActionState(updatePaymentSettings, null);
  // Đủ điều kiện chạy thật: bật công tắc + có webhook + có token API.
  const live = s.auto_enabled && apiReady && webhookReady;

  return (
    <details className="group rounded-[var(--radius-card)] border border-ink/10 bg-paper shadow-[var(--shadow-soft)]">
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center gap-3 px-4 py-3 text-sm">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${live ? "bg-herb" : "bg-clay"}`} />
        <span className="flex-1 min-w-0">
          <span className="font-medium">Tự động chốt: </span>
          {live ? (
            <span className="text-ink/60">
              đang chạy · học phí ≤ {formatVnd(s.auto_course_max)} · nạp xu ≤{" "}
              {formatVnd(s.auto_topup_max)}
            </span>
          ) : !s.auto_enabled ? (
            <span className="text-ink/60">đang tắt — mọi đơn chờ bạn chốt</span>
          ) : (
            <span className="text-clay">chưa chạy — thiếu cấu hình SePay</span>
          )}
        </span>
        <span className="text-ink/40 transition-transform group-open:rotate-90 shrink-0">▸</span>
      </summary>

      <div className="border-t border-ink/10 px-4 py-4 space-y-4">
        <form action={action} className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="auto_enabled" defaultChecked={s.auto_enabled} />
            <span>Bật tự động chốt (bỏ chọn = tắt khẩn cấp, quay về chốt tay)</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0">
              <span className="text-xs text-ink/70">Trần học phí (VND)</span>
              <input
                name="auto_course_max"
                type="number"
                min={0}
                step={10000}
                defaultValue={s.auto_course_max}
                className={inputCls}
              />
            </label>
            <label className="block min-w-0">
              <span className="text-xs text-ink/70">Trần nạp xu (VND)</span>
              <input
                name="auto_topup_max"
                type="number"
                min={0}
                step={10000}
                defaultValue={s.auto_topup_max}
                className={inputCls}
              />
            </label>
          </div>
          <p className="text-xs text-ink/45">
            Đơn lớn hơn trần, chuyển thừa/thiếu, hay SePay không xác nhận được
            thì vẫn chờ bạn chốt. Đặt 0 = không tự chốt loại đó.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={pending} className={buttonClass("outline", "!py-2")}>
              {pending ? "Đang lưu…" : "Lưu"}
            </button>
            {state && (
              <span className={`text-sm ${state.ok ? "text-herb" : "text-clay"}`}>
                {state.message}
              </span>
            )}
          </div>
        </form>

        <ul className="text-xs space-y-1 border-t border-ink/10 pt-3">
          <Check ok={webhookReady} label="Webhook SePay (PAYMENT_WEBHOOK_SECRET)" />
          <Check ok={apiReady} label="Xác minh qua SePay API (SEPAY_API_TOKEN)" />
          <li className="text-ink/50">
            Thông báo về điện thoại: bật ở trang Tổng quan trên điện thoại của bạn.
          </li>
        </ul>
      </div>
    </details>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? "text-herb" : "text-clay"}>
      {ok ? "✓" : "✗"} {label}
    </li>
  );
}
