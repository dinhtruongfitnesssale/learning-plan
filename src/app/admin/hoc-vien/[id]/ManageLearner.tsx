"use client";

import { useActionState } from "react";
import {
  updateLearner,
  resetLearnerPassword,
  deleteLearner,
} from "../../actions";
import { Card, buttonClass } from "@/components/ui";
import { SendEmailButton } from "../SendEmailButton";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

export function ManageLearner({
  id,
  fullName,
  email,
}: {
  id: string;
  fullName: string;
  email: string;
}) {
  const [editState, editAction, editPending] = useActionState(updateLearner, null);
  const [pwState, pwAction, pwPending] = useActionState(
    resetLearnerPassword,
    null,
  );

  return (
    <Card className="p-5 space-y-5">
      {/* Sửa thông tin */}
      <form action={editAction} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-ink/70">Họ tên</span>
            <input name="full_name" defaultValue={fullName} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm text-ink/70">Email</span>
            <input
              name="email"
              type="email"
              defaultValue={email}
              className={inputCls}
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button disabled={editPending} className={buttonClass("primary")}>
            {editPending ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
          {editState?.ok && (
            <span className="text-herb text-sm font-medium">✓ {editState.message}</span>
          )}
          {editState && !editState.ok && (
            <span className="text-clay text-sm">{editState.message}</span>
          )}
        </div>
      </form>

      <hr className="rule" />

      {/* Đặt lại mật khẩu */}
      <div className="flex flex-wrap items-center gap-3">
        <form action={pwAction}>
          <input type="hidden" name="id" value={id} />
          <button disabled={pwPending} className={buttonClass("outline")}>
            {pwPending ? "Đang tạo…" : "Đặt lại mật khẩu"}
          </button>
        </form>
        {pwState?.ok && pwState.password && (
          <span className="text-sm">
            {pwState.message}{" "}
            <span className="font-mono font-semibold select-all bg-herb-soft px-2 py-0.5 rounded">
              {pwState.password}
            </span>
          </span>
        )}
        {pwState && !pwState.ok && (
          <span className="text-clay text-sm">{pwState.message}</span>
        )}
      </div>

      {pwState?.ok && pwState.password && (
        <SendEmailButton
          email={email}
          password={pwState.password}
          fullName={fullName}
        />
      )}

      <hr className="rule" />

      {/* Xóa học viên */}
      <form
        action={deleteLearner}
        onSubmit={(e) => {
          if (
            !confirm(
              `Xóa hẳn tài khoản "${fullName || email}"? Toàn bộ tiến độ, ghi danh, điểm sẽ mất và KHÔNG khôi phục được.`,
            )
          )
            e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button className={buttonClass("danger")}>Xóa học viên này</button>
        <p className="text-xs text-ink/45 mt-2">
          Hành động không thể hoàn tác.
        </p>
      </form>
    </Card>
  );
}
