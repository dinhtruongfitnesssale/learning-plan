"use client";

import { useActionState } from "react";
import { updateCoinSettings, adjustCoins } from "../actions";
import { buttonClass } from "@/components/ui";
import type { CoinSettings } from "@/lib/supabase/types";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

function Num({
  name,
  label,
  hint,
  value,
}: {
  name: keyof CoinSettings;
  label: string;
  hint?: string;
  value: number;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm text-ink/70">{label}</span>
      <input
        name={name}
        type="number"
        min={0}
        defaultValue={value}
        className={inputCls}
      />
      {hint && <span className="text-xs text-ink/45">{hint}</span>}
    </label>
  );
}

export function CoinSettingsForm({ s }: { s: CoinSettings }) {
  const [state, action, pending] = useActionState(updateCoinSettings, null);
  return (
    <form action={action} className="space-y-5">
      <div>
        <h3 className="font-medium mb-2">Tốc độ cày</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Num
            name="daily_cap"
            label="Trần xu/ngày từ học bài + quiz"
            hint="Van tốc độ: thấp = cày chậm, nhiều người nạp hơn."
            value={s.daily_cap}
          />
          <Num
            name="reward_checkin"
            label="Điểm danh mỗi ngày"
            hint="Không tính vào trần."
            value={s.reward_checkin}
          />
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-2">Thưởng học tập</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Num name="reward_lesson" label="Học xong 1 bài" value={s.reward_lesson} />
          <Num name="reward_quiz" label="Đạt quiz bài (lần đầu)" value={s.reward_quiz} />
          <Num
            name="reward_module_quiz"
            label="Đạt quiz chương"
            value={s.reward_module_quiz}
          />
          <Num
            name="reward_streak7"
            label="Mốc chuỗi 7 ngày"
            value={s.reward_streak7}
          />
          <Num name="reward_review" label="Đánh giá khóa" value={s.reward_review} />
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-2">Giới thiệu bạn bè</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Num
            name="referral_inviter"
            label="Người mời nhận"
            hint="Khi bạn mới học xong bài đầu."
            value={s.referral_inviter}
          />
          <Num
            name="referral_invitee"
            label="Bạn mới nhận"
            hint="Ngay khi tạo tài khoản."
            value={s.referral_invitee}
          />
          <Num
            name="referral_monthly_limit"
            label="Lượt thưởng tối đa/tháng"
            hint="Mỗi người mời. 0 = không giới hạn."
            value={s.referral_monthly_limit}
          />
        </div>
        <label className="mt-3 flex items-start gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="signup_enabled"
            defaultChecked={s.signup_enabled}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-ink"
          />
          <span>
            Cho phép tự đăng ký tài khoản qua link giới thiệu
            <span className="block text-xs text-ink/45">
              Tắt thì link giới thiệu ngừng hoạt động; tài khoản vẫn chỉ do
              coach tạo như cũ.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={buttonClass("primary")}>
          {pending ? "Đang lưu…" : "Lưu cấu hình"}
        </button>
        {state && (
          <span className={`text-sm ${state.ok ? "text-herb" : "text-clay"}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

export function AdjustCoinsForm() {
  const [state, action, pending] = useActionState(adjustCoins, null);
  return (
    <form action={action} className="space-y-3">
      <div className="grid sm:grid-cols-[1fr_120px] gap-3">
        <label className="block min-w-0">
          <span className="text-sm text-ink/70">Email học viên</span>
          <input name="email" type="email" required className={inputCls} />
        </label>
        <label className="block min-w-0">
          <span className="text-sm text-ink/70">Số xu (âm = trừ)</span>
          <input name="amount" type="number" required className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className="text-sm text-ink/70">Ghi chú (học viên thấy)</span>
        <input
          name="note"
          placeholder="VD: Thưởng top tuần, bù lỗi chuyển khoản…"
          className={inputCls}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={buttonClass("outline")}>
          {pending ? "Đang lưu…" : "Áp dụng"}
        </button>
        {state && (
          <span className={`text-sm ${state.ok ? "text-herb" : "text-clay"}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
