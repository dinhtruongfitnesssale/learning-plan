"use client";

import { useActionState, useMemo, useState } from "react";
import { inviteGuestsToCourse } from "../../actions";
import { parseEmails } from "@/lib/slug";
import { Card, buttonClass } from "@/components/ui";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

// Tặng khóa cho nhiều người bằng cách dán một loạt email. Ai chưa có
// tài khoản sẽ được tạo tự động (khách mời) và nhận email đăng nhập.
export function InviteByEmail({
  courseId,
  courseSlug,
}: {
  courseId: string;
  courseSlug: string;
}) {
  const [state, action, pending] = useActionState(inviteGuestsToCourse, null);
  const [raw, setRaw] = useState("");
  const [copied, setCopied] = useState(false);

  const { emails, invalid } = useMemo(() => parseEmails(raw), [raw]);

  const createdList = state?.created ?? [];
  const copyAll = async () => {
    const text = createdList
      .map((c) => `${c.email}\t${c.password}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card className="p-5" as="section">
      <h3 className="font-serif text-lg mb-1">Tặng khóa qua email</h3>
      <p className="text-xs text-ink/50 mb-4">
        Dán nhiều email cùng lúc (mỗi dòng một email, hoặc ngăn bằng dấu phẩy).
        Ai chưa có tài khoản sẽ được tạo tự động với mật khẩu ngẫu nhiên và nhận
        email đăng nhập kèm link khóa học. Ai đã có tài khoản nhưng chưa từng
        đăng nhập cũng được cấp mật khẩu mới gửi kèm. Khách mời thấy các khóa
        khác nhưng không tự yêu cầu học được.
      </p>

      <form action={action} className="space-y-3">
        <input type="hidden" name="course_id" value={courseId} />
        <input type="hidden" name="course_slug" value={courseSlug} />
        <textarea
          name="emails"
          rows={5}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"an@gmail.com\nbinh@gmail.com\nchi@gmail.com"}
          className={`${inputCls} font-mono text-xs leading-relaxed`}
        />

        <label className="flex items-start gap-2 text-xs text-ink/70">
          <input
            type="checkbox"
            name="reset_password"
            className="mt-0.5 accent-amber"
          />
          <span>
            Cấp mật khẩu mới cho cả người đã từng đăng nhập (dùng khi họ quên
            mật khẩu — mật khẩu cũ sẽ hết hiệu lực).
          </span>
        </label>

        <div className="flex items-center justify-between text-xs">
          <span className="text-ink/55 font-mono tnum">
            {emails.length} email hợp lệ
          </span>
          {invalid.length > 0 && (
            <span className="text-clay">{invalid.length} dòng sai định dạng</span>
          )}
        </div>

        {invalid.length > 0 && (
          <p className="text-xs text-clay/90 break-words">
            Bỏ qua: {invalid.slice(0, 5).join(", ")}
            {invalid.length > 5 && ` … (+${invalid.length - 5})`}
          </p>
        )}

        <button
          disabled={pending || emails.length === 0}
          className={buttonClass("primary")}
          type="submit"
        >
          {pending
            ? "Đang tạo & gửi…"
            : emails.length > 0
              ? `Tặng khóa cho ${emails.length} người`
              : "Tặng khóa"}
        </button>

        {state && (
          <p className={`text-sm ${state.ok ? "text-herb" : "text-clay"}`}>
            {state.ok ? "✓ " : "⚠ "}
            {state.message}
          </p>
        )}

        {state?.failed && state.failed.length > 0 && (
          <p className="text-xs text-clay break-words">
            Không tạo được: {state.failed.join(", ")}
          </p>
        )}

        {createdList.length > 0 && (
          <div className="rounded-lg border border-ink/10 bg-paper-2 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink/60">
                Email & mật khẩu vừa cấp — chép lại phòng khi email không tới:
              </span>
              <button
                type="button"
                onClick={copyAll}
                className="text-xs link shrink-0"
              >
                {copied ? "Đã chép ✓" : "Chép hết"}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {createdList.map((c) => (
                <div
                  key={c.email}
                  className="flex items-center justify-between gap-3 font-mono text-xs"
                >
                  <span className="truncate text-ink/70">{c.email}</span>
                  <span className="font-semibold text-amber shrink-0">
                    {c.password}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </Card>
  );
}
