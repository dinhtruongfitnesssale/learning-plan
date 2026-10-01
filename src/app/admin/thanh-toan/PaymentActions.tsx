"use client";

import { useActionState, useState } from "react";
import { confirmPayment, rejectPayment } from "../actions";
import { buttonClass } from "@/components/ui";

// Hai nút cho một đơn. Tách ra client component để hiện được lỗi trả về
// từ RPC — với tiền thì nuốt lỗi im lặng là kiểu hỏng tệ nhất: bạn tưởng
// đã mở khóa cho học viên trong khi chưa.
export function PaymentActions({
  paymentId,
  matched,
}: {
  paymentId: string;
  matched: boolean;
}) {
  const [okState, confirm, confirming] = useActionState(confirmPayment, null);
  const [rejState, reject, rejecting] = useActionState(rejectPayment, null);
  const [asking, setAsking] = useState(false);

  const state = okState ?? rejState;
  const busy = confirming || rejecting;

  return (
    <div className="sm:shrink-0 sm:text-right space-y-2">
      {asking ? (
        <form action={reject} className="flex flex-col gap-2 sm:items-end">
          <input type="hidden" name="id" value={paymentId} />
          <input
            name="note"
            placeholder="Lý do từ chối"
            className="w-full sm:w-48 rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
          />
          <div className="btn-row">
            <button
              disabled={busy}
              className={buttonClass("danger")}
              type="submit"
            >
              {rejecting ? "Đang lưu…" : "Xác nhận từ chối"}
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              className={buttonClass("ghost")}
            >
              Thôi
            </button>
          </div>
        </form>
      ) : (
        <div className="btn-row">
          <form action={confirm}>
            <input type="hidden" name="id" value={paymentId} />
            <button
              disabled={busy}
              className={buttonClass("primary")}
              type="submit"
              // Đơn chưa khớp tiền mà vẫn chốt được là CỐ Ý: học viên
              // chuyển nhầm nội dung, bạn tự đối chiếu sao kê rồi mở tay.
              title={
                matched
                  ? "Tiền đã về đúng mã — mở khóa học"
                  : "Chưa thấy tiền về. Chỉ chốt khi bạn đã tự đối chiếu sao kê."
              }
            >
              {confirming ? "Đang mở…" : matched ? "Chốt & mở khóa" : "Mở tay"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setAsking(true)}
            className={buttonClass("ghost")}
          >
            Từ chối
          </button>
        </div>
      )}

      {state && (
        <p className={`text-xs ${state.ok ? "text-herb" : "text-clay"}`}>
          {state.ok ? "✓ " : "⚠ "}
          {state.message}
        </p>
      )}
    </div>
  );
}
