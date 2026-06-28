"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buttonClass } from "@/components/ui";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3.5 py-2.5 pr-12 text-ink placeholder:text-ink/35 outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 transition";

export function ChangePasswordForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 6) {
      setMsg({ ok: false, text: "Mật khẩu cần ít nhất 6 ký tự." });
      return;
    }
    if (pw !== pw2) {
      setMsg({ ok: false, text: "Hai ô mật khẩu chưa khớp nhau." });
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) {
      setMsg({ ok: false, text: "Lỗi: " + error.message });
      return;
    }
    setPw("");
    setPw2("");
    setMsg({ ok: true, text: "Đã đổi mật khẩu thành công. Lần sau dùng mật khẩu mới nhé." });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-sm">
      <label className="block">
        <span className="block text-sm font-medium text-ink/70 mb-1.5">
          Mật khẩu mới
        </span>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className={inputCls}
            placeholder="Ít nhất 6 ký tự"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute inset-y-0 right-0 px-3 grid place-items-center text-ink/45 hover:text-ink transition-colors"
          >
            {show ? "🙈" : "👁️"}
          </button>
        </div>
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-ink/70 mb-1.5">
          Nhập lại mật khẩu mới
        </span>
        <input
          type={show ? "text" : "password"}
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          className={inputCls.replace(" pr-12", "")}
          placeholder="Gõ lại cho khớp"
          autoComplete="new-password"
        />
      </label>

      {msg && (
        <p
          className={`text-sm rounded-lg px-3 py-2 ${
            msg.ok ? "text-herb bg-herb-soft" : "text-clay bg-clay-soft"
          }`}
        >
          {msg.text}
        </p>
      )}

      <button type="submit" disabled={loading} className={buttonClass("primary")}>
        {loading ? "Đang đổi…" : "Đổi mật khẩu"}
      </button>
    </form>
  );
}
