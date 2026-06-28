"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { buttonClass } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email hoặc mật khẩu chưa đúng.");
      setLoading(false);
      return;
    }
    // Điều hướng theo vai trò.
    const { data } = await supabase.auth.getUser();
    let dest = params.get("next") || "/hoc";
    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      if (profile?.role === "coach") dest = "/admin";
    }
    router.replace(dest);
    router.refresh();
  }

  return (
    <main className="flex-1 grid place-items-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-3 mb-8">
          <Image src="/logo.png" alt={APP_NAME} width={40} height={40} />
          <span className="font-serif text-xl">{APP_NAME}</span>
        </Link>

        <p className="eyebrow mb-2">Đăng nhập</p>
        <h1 className="font-serif text-3xl mb-1">Chào bạn trở lại</h1>
        <p className="text-ink/60 text-sm mb-7">
          Tiếp tục bài học còn dang dở của bạn.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="ban@email.com"
            />
          </Field>
          <Field label="Mật khẩu">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-12`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute inset-y-0 right-0 px-3 grid place-items-center text-ink/45 hover:text-ink transition-colors"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </Field>

          {error && (
            <p className="text-sm text-clay bg-clay-soft rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={buttonClass("primary", "w-full")}
          >
            {loading ? "Đang vào…" : "Vào học"}
          </button>
        </form>

        <p className="text-xs text-ink/45 mt-6 leading-relaxed">
          Chưa có tài khoản? Tài khoản do coach tạo và gửi cho bạn. Liên hệ coach
          nếu bạn chưa nhận được thông tin đăng nhập.
        </p>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-paper px-3.5 py-2.5 text-ink placeholder:text-ink/35 outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink/70 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
